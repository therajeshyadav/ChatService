const Friends = require('../models/friend');
const axios = require("axios");

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:5000";

exports.getFriends = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Get all friend relationships where user is involved
    const friendships = await Friends.find({
      $or: [
        { userId: currentUserId },
        { friendId: currentUserId }
      ]
    });

    if (!friendships || friendships.length === 0) {
      return res.json([]);
    }

    // Get all unique user IDs
    const userIds = new Set();
    friendships.forEach(f => {
      if (f.userId !== currentUserId) userIds.add(f.userId);
      if (f.friendId !== currentUserId) userIds.add(f.friendId);
    });

    // Fetch usernames from AuthService
    let usersMap = {};
    try {
      const response = await axios.post(`${AUTH_SERVICE_URL}/api/auth/users/batch`, {
        userIds: Array.from(userIds)
      });
      response.data.forEach(user => {
        usersMap[user.id] = user.username;
      });
    } catch (err) {
      console.error("Failed to fetch usernames:", err.message);
    }

    // Format response
    const formattedFriends = friendships.map(f => {
      const friendId = f.userId === currentUserId ? f.friendId : f.userId;
      return {
        _id: f._id,
        userId: currentUserId,
        friendId: friendId,
        friendUsername: usersMap[friendId] || `User ${friendId}`,
        status: f.status,
        requestedBy: f.requestedBy,
        createdAt: f.createdAt
      };
    });

    res.json(formattedFriends);
  } catch (error) {
    console.error("Get friends error:", error);
    res.status(500).json({ message: "Friends fetch error" });
  }
};

exports.sendFriendRequest = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    // Fetch user by username from AuthService
    let userToAdd;
    try {
      const response = await axios.get(
        `${AUTH_SERVICE_URL}/api/auth/users/username/${username}`
      );
      userToAdd = response.data;
    } catch (err) {
      return res.status(404).json({ message: "User not found" });
    }

    if (userToAdd.id === currentUserId) {
      return res.status(400).json({ message: "You cannot add yourself" });
    }

    // Check if friendship already exists
    const existingFriend = await Friends.findOne({
      $or: [
        { userId: currentUserId, friendId: userToAdd.id },
        { userId: userToAdd.id, friendId: currentUserId }
      ]
    });

    if (existingFriend) {
      return res.status(400).json({ message: "Friend request already exists" });
    }

    // Create friend request
    const friend = await Friends.create({
      userId: currentUserId,
      friendId: userToAdd.id,
      status: "pending",
      requestedBy: currentUserId
    });

    res.status(201).json({
      ...friend.toObject(),
      friendUsername: userToAdd.username
    });
  } catch (error) {
    console.error("Send friend request error:", error);
    res.status(500).json({ message: "Failed to send friend request" });
  }
};

exports.acceptFriendRequest = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { friendId } = req.params;

    const friendship = await Friends.findById(friendId);
    
    if (!friendship) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    // Verify the current user is the recipient
    if (friendship.friendId !== currentUserId) {
      return res.status(403).json({ message: "You can only accept requests sent to you" });
    }

    friendship.status = "accepted";
    await friendship.save();

    res.json(friendship);
  } catch (error) {
    console.error("Accept friend request error:", error);
    res.status(500).json({ message: "Failed to accept friend request" });
  }
};

exports.rejectFriendRequest = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { friendId } = req.params;

    const friendship = await Friends.findById(friendId);
    
    if (!friendship) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    // Verify the current user is the recipient
    if (friendship.friendId !== currentUserId) {
      return res.status(403).json({ message: "You can only reject requests sent to you" });
    }

    await Friends.findByIdAndDelete(friendId);

    res.json({ message: "Friend request rejected" });
  } catch (error) {
    console.error("Reject friend request error:", error);
    res.status(500).json({ message: "Failed to reject friend request" });
  }
};

exports.removeFriend = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { friendId } = req.params;

    const friendship = await Friends.findById(friendId);
    
    if (!friendship) {
      return res.status(404).json({ message: "Friendship not found" });
    }

    // Verify the current user is part of this friendship
    if (friendship.userId !== currentUserId && friendship.friendId !== currentUserId) {
      return res.status(403).json({ message: "You can only remove your own friends" });
    }

    await Friends.findByIdAndDelete(friendId);

    res.json({ message: "Friend removed successfully" });
  } catch (error) {
    console.error("Remove friend error:", error);
    res.status(500).json({ message: "Failed to remove friend" });
  }
};
