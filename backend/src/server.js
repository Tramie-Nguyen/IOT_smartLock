import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import dotenv from "dotenv";
import router from "./route.js";
import mqttClient from "./mqtt.js";
import initSocket from "./socket.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes (API)
app.use("/api", router);

const server = http.createServer(app);

// Socket server
const io = new Server(server, {
  cors: { origin: "*" }
});

// Khởi tạo socket handler
initSocket(io);

// Khởi động MQTT (client connect auto)
mqttClient.on("connect", () => {
  console.log("MQTT Connected!");
});

mqttClient.on("error", (err) => {
  console.log("MQTT Error:", err);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
