const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const { 
  getFriends, 
  sendFriendRequest, 
  acceptFriendRequest, 
  rejectFriendRequest, 
  removeFriend 
} = require("../controllers/friendController");

router.get("/", auth, getFriends);
router.post("/request", auth, sendFriendRequest);
router.post("/:friendId/accept", auth, acceptFriendRequest);
router.post("/:friendId/reject", auth, rejectFriendRequest);
router.delete("/:friendId", auth, removeFriend);

module.exports = router;