export default function initSocket(io) {
  // Cho mqtt.js gọi được socket
  global.io = io;

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
}
