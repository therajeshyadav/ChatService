const mongoose = require("mongoose");

const friendSchema = new mongoose.Schema(
  {
    userId: {
      type: Number,
      required: true,
    },
    friendId: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "blocked"],
      default: "pending",
    },
    // Who sent the request
    requestedBy: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index to prevent duplicate friend requests
friendSchema.index({ userId: 1, friendId: 1 }, { unique: true });

module.exports = mongoose.model("Friend", friendSchema);
