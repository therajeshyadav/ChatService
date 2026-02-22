const Message = require("../models/message");
const Friends = require("../models/friend");

// Track online users per server
const onlineUsers = new Map(); // serverId -> Set of userIds

const chatSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.user.id, socket.user.username);

    // Join user's personal room for friend notifications
    socket.join(`user_${socket.user.id}`);

    socket.on("join_server", (serverId) => {
      socket.join(`server_${serverId}`);
      
      // Track online user
      if (!onlineUsers.has(serverId)) {
        onlineUsers.set(serverId, new Set());
      }
      onlineUsers.get(serverId).add(socket.user.id.toString());
      
      // Broadcast updated online users to all members
      io.to(`server_${serverId}`).emit("online_users_update", {
        serverId,
        onlineUsers: Array.from(onlineUsers.get(serverId)),
      });
      
      console.log(`User ${socket.user.username} joined server ${serverId}`);
    });

    socket.on("leave_server", (serverId) => {
      socket.leave(`server_${serverId}`);
      
      // Remove from online users
      if (onlineUsers.has(serverId)) {
        onlineUsers.get(serverId).delete(socket.user.id.toString());
        
        // Broadcast updated online users
        io.to(`server_${serverId}`).emit("online_users_update", {
          serverId,
          onlineUsers: Array.from(onlineUsers.get(serverId)),
        });
      }
      
      console.log(`User ${socket.user.username} left server ${serverId}`);
    });

    socket.on("join_channel", (channelId) => {
      socket.join(channelId);
      console.log(`User ${socket.user.username} joined channel ${channelId}`);
    });

    socket.on("leave_channel", (channelId) => {
      socket.leave(channelId);
      console.log(`User ${socket.user.username} left channel ${channelId}`);
    });

    socket.on("send_message", async (data) => {
      try {
        const messageData = {
          channelId: data.channelId,
          senderId: socket.user.id,
          content: data.content,
        };

        // Add attachments if present
        if (data.attachments && data.attachments.length > 0) {
          messageData.attachments = data.attachments;
        }

        const message = await Message.create(messageData);

        // Convert to plain object and add string senderId + username for frontend
        const messageObj = message.toObject();
        messageObj.senderId = messageObj.senderId.toString();
        messageObj.senderUsername = socket.user.username; // Add username from JWT

        io.to(data.channelId).emit("receive_message", messageObj);
      } catch (error) {
        console.error("Message error:", error);
      }
    });

    // Friend request events
    socket.on("send_friend_request", async (data) => {
      try {
        const { friendId, friendUsername } = data;
        
        // Notify the recipient in real-time
        io.to(`user_${friendId}`).emit("friend_request_received", {
          userId: socket.user.id,
          username: socket.user.username,
          status: "pending",
        });

        console.log(`Friend request sent from ${socket.user.username} to user ${friendId}`);
      } catch (error) {
        console.error("Send friend request socket error:", error);
      }
    });

    socket.on("accept_friend_request", async (data) => {
      try {
        const { friendshipId, friendId } = data;
        
        // Notify the requester that their request was accepted
        io.to(`user_${friendId}`).emit("friend_request_accepted", {
          userId: socket.user.id,
          username: socket.user.username,
          friendshipId,
        });

        console.log(`Friend request accepted by ${socket.user.username}`);
      } catch (error) {
        console.error("Accept friend request socket error:", error);
      }
    });

    socket.on("reject_friend_request", async (data) => {
      try {
        const { friendId } = data;
        
        // Notify the requester that their request was rejected
        io.to(`user_${friendId}`).emit("friend_request_rejected", {
          userId: socket.user.id,
        });

        console.log(`Friend request rejected by ${socket.user.username}`);
      } catch (error) {
        console.error("Reject friend request socket error:", error);
      }
    });

    socket.on("remove_friend", async (data) => {
      try {
        const { friendId } = data;
        
        // Notify the friend that they were removed
        io.to(`user_${friendId}`).emit("friend_removed", {
          userId: socket.user.id,
        });

        console.log(`Friend removed by ${socket.user.username}`);
      } catch (error) {
        console.error("Remove friend socket error:", error);
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.user.username);
      
      // Remove from all servers
      onlineUsers.forEach((users, serverId) => {
        if (users.has(socket.user.id.toString())) {
          users.delete(socket.user.id.toString());
          
          // Broadcast updated online users
          io.to(`server_${serverId}`).emit("online_users_update", {
            serverId,
            onlineUsers: Array.from(users),
          });
        }
      });
    });
  });
};

module.exports = chatSocket;
