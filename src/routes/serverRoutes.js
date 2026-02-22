const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const {
  getServers,
  createServer,
  createChannel,
  generateInvite,
  joinServer,
  getMembers,
  updateServer,
  deleteServer,
  updateChannel,
  deleteChannel,
} = require("../controllers/serverController");

router.get("/", auth, getServers);
router.post("/", auth, createServer);
router.put("/:serverId", auth, updateServer);
router.delete("/:serverId", auth, deleteServer);
router.post("/:serverId/channels", auth, createChannel);
router.put("/:serverId/channels/:channelId", auth, updateChannel);
router.delete("/:serverId/channels/:channelId", auth, deleteChannel);
router.post("/:serverId/invite", auth, generateInvite);
router.post("/join", auth, joinServer);
router.get("/:serverId/members", auth, getMembers);

module.exports = router;
