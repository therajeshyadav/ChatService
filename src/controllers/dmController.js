const DirectMessage = require("../models/directMessage");
const Message = require("../models/message");
const axios = require("axios");

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:5000";

exports.getOrCreateDM = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({ message: "Friend ID is required" });
    }

    // Sort IDs to ensure consistent ordering
    const participants = [currentUserId, parseInt(friendId)].sort((a, b) => a - b);

    // Find existing DM or create new one
    let dm = await DirectMessage.findOne({ participants });

    if (!dm) {
      dm = await DirectMessage.create({ participants });
    }

    // Fetch usernames from AuthService
    try {
      const response = await axios.post(`${AUTH_SERVICE_URL}/api/auth/users/batch`, {
        userIds: participants,
      });
      
      const users = response.data;
      const usersMap = {};
      users.forEach(user => {
        usersMap[user.id] = user.username;
      });

      // Add usernames to response
      const dmWithUsernames = {
        ...dm.toObject(),
        participantDetails: participants.map(id => ({
          id,
          username: usersMap[id] || `User ${id}`,
        })),
      };

      res.json(dmWithUsernames);
    } catch (err) {
      console.error("Failed to fetch usernames:", err.message);
      res.json(dm);
    }
  } catch (error) {
    console.error("Get or create DM error:", error);
    res.status(500).json({ message: "Failed to get or create DM" });
  }
};

exports.getDMs = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Find all DMs where user is a participant
    const dms = await DirectMessage.find({
      participants: currentUserId,
    }).sort({ updatedAt: -1 });

    // Get all unique user IDs
    const userIds = new Set();
    dms.forEach(dm => {
      dm.participants.forEach(id => {
        if (id !== currentUserId) {
          userIds.add(id);
        }
      });
    });

    // Fetch usernames from AuthService
    let usersMap = {};
    try {
      const response = await axios.post(`${AUTH_SERVICE_URL}/api/auth/users/batch`, {
        userIds: Array.from(userIds),
      });
      response.data.forEach(user => {
        usersMap[user.id] = user.username;
      });
    } catch (err) {
      console.error("Failed to fetch usernames:", err.message);
    }

    // Format response
    const formattedDMs = dms.map(dm => {
      const friendId = dm.participants.find(id => id !== currentUserId);
      return {
        _id: dm._id,
        friendId,
        friendUsername: usersMap[friendId] || `User ${friendId}`,
        lastMessage: dm.lastMessage,
        updatedAt: dm.updatedAt,
      };
    });

    res.json(formattedDMs);
  } catch (error) {
    console.error("Get DMs error:", error);
    res.status(500).json({ message: "Failed to fetch DMs" });
  }
};

exports.getDMMessages = async (req, res) => {
  try {
    const { dmId } = req.params;

    // Verify user is participant
    const dm = await DirectMessage.findById(dmId);
    if (!dm) {
      return res.status(404).json({ message: "DM not found" });
    }

    if (!dm.participants.includes(req.user.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Get messages for this DM
    const messages = await Message.find({ channelId: dmId }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    console.error("Get DM messages error:", error);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};
