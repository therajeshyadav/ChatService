require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const connectDB = require("./config/db");
const socketAuth = require("./middleware/socketAuth");
const chatSocket = require("./sockets/chatSocket");

const serverRoutes = require("./routes/serverRoutes");
const channelRoutes = require("./routes/channelRoutes");
const messageRoutes = require("./routes/messageRoutes");
const friendsRoute = require("./routes/friendsRoute");
const dmRoutes = require("./routes/dmRoutes");

const app = express();
const server = http.createServer(app);

connectDB();

app.use(
  cors({
    origin: [
      "http://localhost:8080",
      "http://10.205.15.217:8080"  // Allow external IP access
    ],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

app.use(express.json());

app.use("/api/servers", serverRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/friends", friendsRoute);
app.use("/api/dm", dmRoutes);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:8080",
      "http://10.205.15.217:8080"  // Allow external IP access
    ],
    credentials: true,
  },
});

io.use(socketAuth);

chatSocket(io);

server.listen(process.env.PORT, '0.0.0.0', () => {
  console.log(`Chat service running on port ${process.env.PORT} (accessible externally)`);
});
