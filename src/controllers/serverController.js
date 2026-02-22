const Server = require("../models/server");
const axios = require("axios");

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:5000";

exports.getServers = async (req, res) => {
  console.log("Servers route hit");
  console.log("User ID from auth middleware:", req.user.id);
  try {
    const servers = await Server.find({
      "members.userId": req.user.id,
    });

    res.json(servers);
  } catch (error) {
    res.status(500).json({ message: "Server fetch error" });
  }
};

exports.createServer = async (req, res) => {
  try {
    const { name } = req.body;

    const server = await Server.create({
      name,
      ownerId: req.user.id,
      members: [
        {
          userId: req.user.id,
          role: "owner",
        },
      ],
      channels: [
        {
          name: "general",
          type: "text",
          category: "TEXT CHANNELS",
        },
        {
          name: "General",
          type: "voice",
          category: "VOICE CHANNELS",
        },
      ],
    });

    res.status(201).json(server);
  } catch (error) {
    res.status(500).json({ message: "Server create error" });
  }
};

exports.createChannel = async (req, res) => {
  try {
    const { serverId } = req.params;
    const { name, type, category } = req.body;

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: "Server not found" });
    }

    server.channels.push({
      name,
      type: type || "text",
      category: category || (type === "voice" ? "VOICE CHANNELS" : "TEXT CHANNELS"),
    });

    await server.save();
    res.status(201).json(server);
  } catch (error) {
    res.status(500).json({ message: "Channel create error" });
  }
};

exports.generateInvite = async (req, res) => {
  try {
    const { serverId } = req.params;

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: "Server not found" });
    }

    // Check if user is owner or admin
    const member = server.members.find((m) => m.userId === req.user.id);
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return res.status(403).json({ message: "Permission denied" });
    }

    // Generate invite code if not exists
    if (!server.inviteCode) {
      let inviteCode;
      let isUnique = false;

      // Generate unique code
      while (!isUnique) {
        inviteCode = Math.random().toString(36).substring(2, 10);
        const existing = await Server.findOne({ inviteCode });
        if (!existing) {
          isUnique = true;
        }
      }

      server.inviteCode = inviteCode;
      await server.save();
    }

    res.json({ inviteCode: server.inviteCode });
  } catch (error) {
    console.error("Generate invite error:", error);
    res.status(500).json({ message: "Failed to generate invite" });
  }
};

exports.joinServer = async (req, res) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ message: "Invite code is required" });
    }

    const server = await Server.findOne({ inviteCode: inviteCode.trim() });
    if (!server) {
      return res.status(404).json({ message: "Invalid invite code" });
    }

    // Check if user is already a member
    const isMember = server.members.some((m) => m.userId === req.user.id);
    if (isMember) {
      return res.status(400).json({ message: "You are already a member of this server" });
    }

    // Add user to server
    server.members.push({
      userId: req.user.id,
      role: "member",
    });

    await server.save();
    res.json(server);
  } catch (error) {
    console.error("Join server error:", error);
    res.status(500).json({ message: "Failed to join server" });
  }
};

exports.getMembers = async (req, res) => {
  try {
    const { serverId } = req.params;

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: "Server not found" });
    }

    // Fetch user details from AuthService
    const userIds = server.members.map((member) => member.userId);
    
    try {
      const response = await axios.post(`${AUTH_SERVICE_URL}/api/auth/users/batch`, {
        userIds,
      });

      const users = response.data;
      
      // Map members with user details
      const members = server.members.map((member) => {
        const user = users.find((u) => u.id === member.userId);
        return {
          _id: member.userId.toString(),
          username: user ? user.username : `User ${member.userId}`,
          status: "offline", // Will be updated by socket
          role: member.role,
        };
      });

      res.json(members);
    } catch (authError) {
      console.error("Auth service error:", authError.message);
      // Fallback to basic info if auth service fails
      const members = server.members.map((member) => ({
        _id: member.userId.toString(),
        username: `User ${member.userId}`,
        status: "offline",
        role: member.role,
      }));
      res.json(members);
    }
  } catch (error) {
    console.error("Get members error:", error);
    res.status(500).json({ message: "Failed to fetch members" });
  }
};


exports.updateServer = async (req, res) => {
  try {
    const { serverId } = req.params;
    const { name } = req.body;

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: "Server not found" });
    }

    // Check if user is owner or admin
    const member = server.members.find((m) => m.userId === req.user.id);
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return res.status(403).json({ message: "Permission denied" });
    }

    server.name = name;
    await server.save();

    res.json(server);
  } catch (error) {
    console.error("Update server error:", error);
    res.status(500).json({ message: "Failed to update server" });
  }
};

exports.deleteServer = async (req, res) => {
  try {
    const { serverId } = req.params;

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: "Server not found" });
    }

    // Only owner can delete server
    if (server.ownerId !== req.user.id) {
      return res.status(403).json({ message: "Only owner can delete server" });
    }

    await Server.findByIdAndDelete(serverId);

    res.json({ message: "Server deleted successfully" });
  } catch (error) {
    console.error("Delete server error:", error);
    res.status(500).json({ message: "Failed to delete server" });
  }
};

exports.updateChannel = async (req, res) => {
  try {
    const { serverId, channelId } = req.params;
    const { name } = req.body;

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: "Server not found" });
    }

    // Check if user is owner or admin
    const member = server.members.find((m) => m.userId === req.user.id);
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return res.status(403).json({ message: "Permission denied" });
    }

    const channel = server.channels.id(channelId);
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    channel.name = name;
    await server.save();

    res.json(server);
  } catch (error) {
    console.error("Update channel error:", error);
    res.status(500).json({ message: "Failed to update channel" });
  }
};

exports.deleteChannel = async (req, res) => {
  try {
    const { serverId, channelId } = req.params;

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: "Server not found" });
    }

    // Check if user is owner or admin
    const member = server.members.find((m) => m.userId === req.user.id);
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return res.status(403).json({ message: "Permission denied" });
    }

    // Don't allow deleting the last channel
    if (server.channels.length <= 1) {
      return res.status(400).json({ message: "Cannot delete the last channel" });
    }

    server.channels.pull(channelId);
    await server.save();

    res.json(server);
  } catch (error) {
    console.error("Delete channel error:", error);
    res.status(500).json({ message: "Failed to delete channel" });
  }
};
