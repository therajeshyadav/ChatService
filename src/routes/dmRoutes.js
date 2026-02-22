const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const { getOrCreateDM, getDMs, getDMMessages } = require("../controllers/dmController");

router.post("/create", auth, getOrCreateDM);
router.get("/", auth, getDMs);
router.get("/:dmId/messages", auth, getDMMessages);

module.exports = router;
