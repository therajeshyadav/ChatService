const Message = require("../models/message");

exports.getMessages = async (req, res) => {
  try {
    const { channelId } = req.params;

    const messages = await Message.find({ channelId })
      .sort({ createdAt: 1 })
      .lean();

    // Convert senderId to string for frontend
    // Note: We don't have username in old messages, frontend will show "User X"
    const formattedMessages = messages.map(msg => ({
      ...msg,
      senderId: msg.senderId.toString(),
      senderUsername: msg.senderUsername || null, // Will be null for old messages
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error("Message fetch error:", error);
    res.status(500).json({ message: "Message fetch error" });
  }
};

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Cloudinary returns the file URL in req.file.path
    const fileUrl = req.file.path; // Cloudinary URL
    const fileType = req.file.mimetype.startsWith("image/") ? "image" : "file";

    res.json({
      url: fileUrl,
      type: fileType,
      filename: req.file.originalname,
      size: req.file.size,
    });
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({ message: "File upload failed" });
  }
};
