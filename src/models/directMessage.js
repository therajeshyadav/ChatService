const mongoose = require("mongoose");

const directMessageSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: Number, // User IDs from AuthService
        required: true,
      },
    ],
    lastMessage: {
      content: String,
      senderId: Number,
      createdAt: Date,
    },
  },
  { timestamps: true }
);

// Ensure only 2 participants
directMessageSchema.index({ participants: 1 }, { unique: true });

module.exports = mongoose.model("DirectMessage", directMessageSchema);
