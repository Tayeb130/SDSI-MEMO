const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Configure dotenv first
dotenv.config();

// Import routes
const userRoutes = require("./routes/user.js");
const eventRoutes = require("./routes/event.js");
const notificationRoutes = require('./routes/notification');
const { generateMatFile } = require("./controllers/file.js");

// Initialize express
const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));  // Increased limit for large signal data
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use("/api/user", userRoutes);
app.use("/api/events", eventRoutes);  // Added event routes
app.use('/api/notifications', notificationRoutes); 
app.post("/api/generate-mat", generateMatFile);

app.get("/", (req, res) => {
  res.send("Industrial Monitor Backend API Running");
});

// Socket.io setup
const io = new Server(server);

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("Socket connected", socket.id);

  const interval = setInterval(() => {
    socket.emit("machine:data", {
      rpm: Math.floor(Math.random() * 1000),
      temperature: 60 + Math.random() * 20,
      vibration: Math.random(),
      status: "healthy",
    });
  }, 2000);

  socket.on("disconnect", () => {
    clearInterval(interval);
    console.log("Socket disconnected", socket.id);
  });
});

// Database connection and server start
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    const startServer = (port) => {
      server.listen(port)
        .on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} is busy, trying ${port + 1}...`);
            startServer(port + 1);
          } else {
            console.error('Server error:', err);
            process.exit(1);
          }
        })
        .on('listening', () => {
          console.log(`Server running on port ${port}`);
        });
    };

    startServer(PORT);
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
