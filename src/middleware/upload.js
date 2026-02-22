const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cloudinary storage configuration for chat attachments
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Determine folder and resource type based on file type
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    
    return {
      folder: "nexus-chat/messages", // Folder for message attachments
      allowed_formats: ["jpg", "jpeg", "png", "gif", "webp", "pdf", "doc", "docx", "txt", "zip", "mp4", "mp3"],
      resource_type: isVideo ? "video" : isImage ? "image" : "raw", // raw for documents
      transformation: isImage ? [{ width: 1000, height: 1000, crop: "limit" }] : undefined,
    };
  },
});

// Multer upload instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

module.exports = upload;
