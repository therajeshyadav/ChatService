const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const {
  getChannels,
  createChannel,
} = require("../controllers/channelController");

router.get("/:serverId", auth, getChannels);
router.post("/", auth, createChannel);

module.exports = router;
