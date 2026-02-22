const mongoose = require("mongoose");

const serverSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    ownerId: {
      type: Number, // comes from AuthService
      required: true,
    },
    members: [
      {
        userId: Number,
        role: {
          type: String,
          enum: ["owner", "admin", "member"],
          default: "member",
        },
      },
    ],
    channels: [
      {
        name: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          enum: ["text", "voice"],
          default: "text",
        },
        category: {
          type: String,
          default: "TEXT CHANNELS",
        },
      },
    ],

    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
    },
  },

  { timestamps: true },
);

module.exports = mongoose.model("Server", serverSchema);
