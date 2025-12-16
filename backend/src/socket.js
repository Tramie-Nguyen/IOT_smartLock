import { lastWifiStatus } from "./mqtt.js";

export default function initSocket(io) {
  // Cho mqtt.js gọi được socket
  global.io = io;

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // FE chủ động xin state ban đầu
    socket.on("request_initial_state", () => {
      console.log("Client requested initial state");

      if (lastWifiStatus.connected) {
        socket.emit("051_428_475/esp/wifi_connected", {
          rawPayload: lastWifiStatus.ssid,
          timestamp: lastWifiStatus.timestamp,
        });

        console.log(
          "Sent last WiFi status (on request):",
          lastWifiStatus.ssid
        );
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
}
