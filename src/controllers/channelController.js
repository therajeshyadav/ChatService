const Channel = require("../models/channel");

exports.getChannels = async (req, res) => {
  try {
    const { serverId } = req.params;

    const channels = await Channel.find({ serverId });

    res.json(channels);
  } catch (error) {
    res.status(500).json({ message: "Channel fetch error" });
  }
};

exports.createChannel = async (req, res) => {
  try {
    const { serverId, name, type = "text", category = "general" } = req.body;

    const channel = await Channel.create({
      name,
      serverId,
      type,
      category,
    });

    res.status(201).json(channel);
  } catch (error) {
    console.error("Channel create error:", error);
    res.status(500).json({ message: "Channel create error" });
  }
};
