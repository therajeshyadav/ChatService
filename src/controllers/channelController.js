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
    const { serverId, name } = req.body;

    const channel = await Channel.create({
      name,
      serverId,
    });

    res.status(201).json(channel);
  } catch (error) {
    res.status(500).json({ message: "Channel create error" });
  }
};
