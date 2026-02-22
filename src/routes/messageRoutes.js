const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const { getMessages, uploadFile } = require("../controllers/messageController");

router.get("/:channelId", auth, getMessages);
router.post("/upload", auth, upload.single("file"), uploadFile);

module.exports = router;
