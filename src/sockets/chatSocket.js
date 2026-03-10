const Message = require("../models/message");
const Friends = require("../models/friend");

// ===============================
// ONLINE USERS TRACKING
// ===============================

const onlineUsers = new Map(); // serverId -> Set of userIds
const userStatus = new Map(); // userId -> status (online, idle, dnd, invisible)

// ===============================
// DM CALL STATE TRACKING
// ===============================

// userId -> { friendId, callType: 'voice' | 'video', startTime }
const activeCalls = new Map();

// ===============================
// VOICE CHANNELS TRACKING
// ===============================

// channelId -> Set of userIds in voice channel
const voiceChannelUsers = new Map();

// userId -> channelId (which voice channel user is in)
const userVoiceChannels = new Map();

// ===============================
// TYPING INDICATORS
// ===============================

const typingUsers = new Map(); // channelId -> Set of userIds

// ===============================
// HELPERS
// ===============================

const isUserOnline = (io, userId) => {
  const room = io.sockets.adapter.rooms.get(`user_${userId}`);
  return room && room.size > 0;
};

const isUserBusy = (userId) => {
  return activeCalls.has(userId.toString());
};

const getUserStatus = (userId) => {
  return userStatus.get(userId.toString()) || "online";
};

const chatSocket = (io) => {
  io.on("connection", (socket) => {
    const userId = socket.user.id.toString();
    const username = socket.user.username;

    console.log("User connected:", userId, username);

    // Join personal room
    socket.join(`user_${userId}`);
    console.log(`✅ User ${userId} joined room: user_${userId}`);
    
    // Log all rooms this socket is in
    console.log(`Rooms for ${userId}:`, Array.from(socket.rooms));
    
    // Set initial status
    userStatus.set(userId, "online");

    // ===============================
    // USER STATUS
    // ===============================

    socket.on("set_status", ({ status }) => {
      if (["online", "idle", "dnd", "invisible"].includes(status)) {
        userStatus.set(userId, status);
        
        // Broadcast status to all servers user is in
        onlineUsers.forEach((users, serverId) => {
          if (users.has(userId)) {
            io.to(`server_${serverId}`).emit("user_status_changed", {
              userId,
              status,
            });
          }
        });
      }
    });

    // ===============================
    // SERVER JOIN / LEAVE
    // ===============================

    socket.on("join_server", (serverId) => {
      socket.join(`server_${serverId}`);

      if (!onlineUsers.has(serverId)) {
        onlineUsers.set(serverId, new Set());
      }

      onlineUsers.get(serverId).add(userId);

      io.to(`server_${serverId}`).emit("online_users_update", {
        serverId,
        onlineUsers: Array.from(onlineUsers.get(serverId)),
      });
    });

    socket.on("leave_server", (serverId) => {
      socket.leave(`server_${serverId}`);

      if (onlineUsers.has(serverId)) {
        onlineUsers.get(serverId).delete(userId);

        io.to(`server_${serverId}`).emit("online_users_update", {
          serverId,
          onlineUsers: Array.from(onlineUsers.get(serverId)),
        });
      }
    });

    // ===============================
    // CHANNEL JOIN / LEAVE
    // ===============================

    socket.on("join_channel", (channelId) => {
      socket.join(channelId);
      console.log(`User ${username} joined channel ${channelId}`);
    });

    socket.on("leave_channel", (channelId) => {
      socket.leave(channelId);
      console.log(`User ${username} left channel ${channelId}`);
    });

    // ===============================
    // TYPING INDICATORS
    // ===============================

    socket.on("typing_start", ({ channelId }) => {
      if (!typingUsers.has(channelId)) {
        typingUsers.set(channelId, new Set());
      }
      
      typingUsers.get(channelId).add(userId);
      
      socket.to(channelId).emit("user_typing", {
        channelId,
        userId,
        username,
      });
    });

    socket.on("typing_stop", ({ channelId }) => {
      if (typingUsers.has(channelId)) {
        typingUsers.get(channelId).delete(userId);
      }
      
      socket.to(channelId).emit("user_stopped_typing", {
        channelId,
        userId,
      });
    });

    // ===============================
    // SEND MESSAGE
    // ===============================

    socket.on("send_message", async (data) => {
      try {
        const messageData = {
          channelId: data.channelId,
          senderId: socket.user.id,
          content: data.content,
        };

        if (data.attachments?.length > 0) {
          messageData.attachments = data.attachments;
        }

        const message = await Message.create(messageData);

        const messageObj = message.toObject();
        messageObj.senderId = messageObj.senderId.toString();
        messageObj.senderUsername = username;

        io.to(data.channelId).emit("receive_message", messageObj);
      } catch (error) {
        console.error("Message error:", error);
      }
    });

    // ===============================
    // FRIEND EVENTS
    // ===============================

    socket.on("send_friend_request", ({ friendId }) => {
      io.to(`user_${friendId}`).emit("friend_request_received", {
        userId,
        username,
        status: "pending",
      });
    });

    socket.on("accept_friend_request", ({ friendshipId, friendId }) => {
      io.to(`user_${friendId}`).emit("friend_request_accepted", {
        userId,
        username,
        friendshipId,
      });
    });

    socket.on("reject_friend_request", ({ friendId }) => {
      io.to(`user_${friendId}`).emit("friend_request_rejected", {
        userId,
      });
    });

    socket.on("remove_friend", ({ friendId }) => {
      io.to(`user_${friendId}`).emit("friend_removed", {
        userId,
      });
    });

    // ===============================
    // DM CALLING EVENTS (P2P)
    // ===============================

    // 1️⃣ INIT CALL
    socket.on("dm_call_init", ({ friendId, callType = "voice" }) => {
      const targetId = friendId.toString();
      
      console.log(`📞 Call init from ${userId} to ${targetId}, type: ${callType}`);

      if (!isUserOnline(io, targetId)) {
        console.log(`❌ User ${targetId} is offline`);
        return socket.emit("dm_call_user_offline", { friendId: targetId });
      }

      if (isUserBusy(userId)) {
        console.log(`❌ User ${userId} is already in a call`);
        return socket.emit("dm_call_already_in_call");
      }

      if (isUserBusy(targetId)) {
        console.log(`❌ User ${targetId} is busy`);
        return socket.emit("dm_call_user_busy", { friendId: targetId });
      }

      // Store call info
      activeCalls.set(userId, { 
        friendId: targetId, 
        callType, 
        startTime: Date.now() 
      });
      activeCalls.set(targetId, { 
        friendId: userId, 
        callType, 
        startTime: Date.now() 
      });

      console.log(`✅ Sending call to ${targetId}`);
      
      // Debug: Check if target user is in the room
      const targetRoom = io.sockets.adapter.rooms.get(`user_${targetId}`);
      console.log(`Target room user_${targetId} has ${targetRoom?.size || 0} members`);
      
      io.to(`user_${targetId}`).emit("dm_call_incoming", {
        from: userId,
        username,
        callType,
      });
      
      console.log(`✅ Call event emitted to user_${targetId}`);
    });

    // 2️⃣ REJECT CALL
    socket.on("dm_call_reject", ({ friendId }) => {
      const targetId = friendId.toString();

      io.to(`user_${targetId}`).emit("dm_call_rejected", {
        from: userId,
      });

      activeCalls.delete(userId);
      activeCalls.delete(targetId);
    });

    // 3️⃣ OFFER
    socket.on("dm_call_offer", ({ friendId, offer }) => {
      const targetId = friendId.toString();
      const callInfo = activeCalls.get(userId);

      if (!callInfo || callInfo.friendId !== targetId) return;

      io.to(`user_${targetId}`).emit("dm_call_offer", {
        from: userId,
        offer,
      });
    });

    // 4️⃣ ANSWER
    socket.on("dm_call_answer", ({ friendId, answer }) => {
      const targetId = friendId.toString();
      const callInfo = activeCalls.get(userId);

      if (!callInfo || callInfo.friendId !== targetId) return;

      io.to(`user_${targetId}`).emit("dm_call_answer", {
        from: userId,
        answer,
      });
    });

    // 5️⃣ ICE CANDIDATE
    socket.on("dm_call_ice_candidate", ({ friendId, candidate }) => {
      const targetId = friendId.toString();
      const callInfo = activeCalls.get(userId);

      if (!callInfo || callInfo.friendId !== targetId) return;

      io.to(`user_${targetId}`).emit("dm_call_ice_candidate", {
        from: userId,
        candidate,
      });
    });

    // 6️⃣ END CALL
    socket.on("dm_call_end", ({ friendId }) => {
      const targetId = friendId.toString();
      const callInfo = activeCalls.get(userId);

      if (!callInfo || callInfo.friendId !== targetId) return;

      // Calculate call duration
      const duration = Date.now() - callInfo.startTime;

      io.to(`user_${targetId}`).emit("dm_call_end", {
        from: userId,
        duration,
      });

      activeCalls.delete(userId);
      activeCalls.delete(targetId);
    });

    // ===============================
    // VOICE CHANNELS (Group Voice Chat)
    // ===============================

    // Join voice channel
    socket.on("voice_channel_join", ({ channelId }) => {
      console.log(`🎤 User ${username} joining voice channel ${channelId}`);
      
      // Leave current voice channel if in one
      const currentChannelId = userVoiceChannels.get(userId);
      if (currentChannelId) {
        socket.emit("voice_channel_leave", { channelId: currentChannelId });
      }
      
      // Join new voice channel
      socket.join(`voice_${channelId}`);
      
      if (!voiceChannelUsers.has(channelId)) {
        voiceChannelUsers.set(channelId, new Set());
      }
      
      voiceChannelUsers.get(channelId).add(userId);
      userVoiceChannels.set(userId, channelId);
      
      // Notify other users in the channel
      socket.to(`voice_${channelId}`).emit("voice_channel_user_joined", {
        userId,
        username,
        channelId,
      });
      
      console.log(`✅ User ${username} joined voice channel ${channelId}`);
    });

    // Leave voice channel
    socket.on("voice_channel_leave", ({ channelId }) => {
      console.log(`🎤 User ${username} leaving voice channel ${channelId}`);
      
      socket.leave(`voice_${channelId}`);
      
      if (voiceChannelUsers.has(channelId)) {
        voiceChannelUsers.get(channelId).delete(userId);
        
        // Clean up empty channel
        if (voiceChannelUsers.get(channelId).size === 0) {
          voiceChannelUsers.delete(channelId);
        }
      }
      
      userVoiceChannels.delete(userId);
      
      // Notify other users in the channel
      socket.to(`voice_${channelId}`).emit("voice_channel_user_left", {
        userId,
        channelId,
      });
      
      console.log(`✅ User ${username} left voice channel ${channelId}`);
    });

    // WebRTC signaling for voice channels
    socket.on("voice_channel_offer", ({ channelId, targetUserId, offer }) => {
      console.log(`🔗 Voice channel offer from ${userId} to ${targetUserId} in ${channelId}`);
      
      io.to(`user_${targetUserId}`).emit("voice_channel_offer", {
        from: userId,
        offer,
        channelId,
      });
    });

    socket.on("voice_channel_answer", ({ channelId, targetUserId, answer }) => {
      console.log(`🔗 Voice channel answer from ${userId} to ${targetUserId} in ${channelId}`);
      
      io.to(`user_${targetUserId}`).emit("voice_channel_answer", {
        from: userId,
        answer,
        channelId,
      });
    });

    socket.on("voice_channel_ice_candidate", ({ channelId, targetUserId, candidate }) => {
      io.to(`user_${targetUserId}`).emit("voice_channel_ice_candidate", {
        from: userId,
        candidate,
        channelId,
      });
    });

    // Mute/unmute in voice channel
    socket.on("voice_channel_mute", ({ channelId, isMuted }) => {
      console.log(`🔇 User ${username} ${isMuted ? 'muted' : 'unmuted'} in voice channel ${channelId}`);
      
      socket.to(`voice_${channelId}`).emit("voice_channel_user_muted", {
        userId,
        isMuted,
        channelId,
      });
    });

    // ===============================
    // DISCONNECT
    // ===============================

    socket.on("disconnect", () => {
      console.log("User disconnected:", username);

      // Handle active call cleanup
      const callInfo = activeCalls.get(userId);

      if (callInfo) {
        const friendId = callInfo.friendId;
        
        io.to(`user_${friendId}`).emit("dm_call_user_disconnected", {
          userId,
        });

        activeCalls.delete(userId);
        activeCalls.delete(friendId);
      }

      // Handle voice channel cleanup
      const voiceChannelId = userVoiceChannels.get(userId);
      if (voiceChannelId) {
        console.log(`🎤 Cleaning up voice channel ${voiceChannelId} for disconnected user ${username}`);
        
        if (voiceChannelUsers.has(voiceChannelId)) {
          voiceChannelUsers.get(voiceChannelId).delete(userId);
          
          // Notify other users in voice channel
          socket.to(`voice_${voiceChannelId}`).emit("voice_channel_user_left", {
            userId,
            channelId: voiceChannelId,
          });
          
          // Clean up empty channel
          if (voiceChannelUsers.get(voiceChannelId).size === 0) {
            voiceChannelUsers.delete(voiceChannelId);
          }
        }
        
        userVoiceChannels.delete(userId);
      }

      // Clean up typing indicators
      typingUsers.forEach((users, channelId) => {
        if (users.has(userId)) {
          users.delete(userId);
          io.to(channelId).emit("user_stopped_typing", {
            channelId,
            userId,
          });
        }
      });

      // Clean up online users
      onlineUsers.forEach((users, serverId) => {
        if (users.has(userId)) {
          users.delete(userId);

          io.to(`server_${serverId}`).emit("online_users_update", {
            serverId,
            onlineUsers: Array.from(users),
          });
        }
      });
      
      // Remove user status
      userStatus.delete(userId);
    });
  });
};

module.exports = chatSocket;