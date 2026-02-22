const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    channelId: {
      type: String,
      required: true,
    },
    senderId: {
      type: Number,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    attachments: [
      {
        type: {
          type: String,
          enum: ["image", "file"],
        },
        url: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
