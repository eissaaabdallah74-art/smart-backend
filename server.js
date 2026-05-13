// server.js
require("dotenv").config();
console.log("SERVER FILE:", __filename);
console.log("SERVER PID:", process.pid);
console.log("APP RESOLVE:", require.resolve("./app"));

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const PORT = process.env.PORT || 5200;
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// Attach io to app to make it accessible in routes/controllers
app.set("io", io);

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  if (userId) {
    socket.join(`user_${userId}`);
  }

  // Join group rooms (Department or Managers)
  socket.on("join_room", (roomName) => {
    socket.join(roomName);
    console.log(`User ${userId} joined room: ${roomName}`);
  });

  // Handle Internal Messaging
  socket.on("send_message", async (data) => {
    try {
      const { room_type, room_name, message, receiver_id } = data;
      const { ChatMessage, Auth } = require("./src/models");

      // Save to database
      const newMessage = await ChatMessage.create({
        sender_id: userId,
        receiver_id: room_type === 'private' ? receiver_id : null,
        room_type,
        room_name,
        message
      });

      // Include sender info for frontend
      const messageWithSender = await ChatMessage.findByPk(newMessage.id, {
        include: [{ model: Auth, as: 'sender', attributes: ['id', 'fullName', 'role', 'position', 'profileImage'] }]
      });

      // Broadcast to room
      if (room_type === 'private') {
        // Send to both sender and receiver
        io.to(`user_${userId}`).emit("new_message", messageWithSender);
        io.to(`user_${receiver_id}`).emit("new_message", messageWithSender);
      } else {
        // Send to group room
        io.to(room_name).emit("new_message", messageWithSender);
      }
    } catch (error) {
      console.error("Socket send_message error:", error);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server is running on http://127.0.0.1:${PORT}`);
});

