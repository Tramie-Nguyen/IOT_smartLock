import mqtt from "mqtt";
import { pushNotification } from "./controller.js";

const mqttUrl = "mqtt://broker.hivemq.com:1883"; 

const options = {
  clientId: "backend_server_" + Date.now(),
  clean: true
};

const mqttClient = mqtt.connect(mqttUrl, options);

// Khi nhận dữ liệu từ ESP
mqttClient.on("message", (topic, message) => {
  const msg = message.toString();
  console.log("MQTT Message:", topic, msg);

  if (topic === "051_428_475/esp/nfc-failed") {
    console.log(`NFC authentication failed ${msg} times on Smart Lock at ${new Date().toLocaleString("vi-VN", {timeZone: "Asia/Ho_Chi_Minh"})}.`);
    pushNotification(`NFC authentication failed ${msg} times on Smart Lock at ${new Date().toLocaleString("vi-VN", {timeZone: "Asia/Ho_Chi_Minh"})}.`);
  }
  else if (topic === "051_428_475/esp/keypad-failed") {
    console.log(`Keypad authentication failed ${msg} times on Smart Lock at ${new Date().toLocaleString("vi-VN", {timeZone: "Asia/Ho_Chi_Minh"})}.`);
    pushNotification(`Keypad authentication failed ${msg} times on Smart Lock at ${new Date().toLocaleString("vi-VN", {timeZone: "Asia/Ho_Chi_Minh"})}.`);
  }
  else if (topic === "051_428_475/esp/loitering-detected") {
    console.log(`${msg} at ${new Date().toLocaleString("vi-VN", {timeZone: "Asia/Ho_Chi_Minh"})}.`);
    pushNotification(`${msg} at ${new Date().toLocaleString("vi-VN", {timeZone: "Asia/Ho_Chi_Minh"})}.`);
  }
  else if (topic === "051_428_475/esp/door_status") {
    console.log("Door status update:", msg);
    // Parse door status and broadcast to frontend
    try {
      const statusData = JSON.parse(msg);
      if (global.io) {
        global.io.emit("door_status_update", statusData);
      }
    } catch (error) {
      console.error("Error parsing door status:", error);
    }
  }
  else if (topic === "051_428_475/esp/door_action") {
    console.log("Door action completed:", msg);
    // Broadcast door action result to frontend
    try {
      const actionData = JSON.parse(msg);
      if (global.io) {
        global.io.emit("door_action_complete", actionData);
      }
    } catch (error) {
      console.error("Error parsing door action:", error);
    }
  }

  // Gửi cho FE qua socket cho các topic khác
  if (global.io) {
    global.io.emit(topic, { message: msg });
  }
});

// Subscribe các topic ESP gửi lên
mqttClient.on("connect", () => {
  console.log("MQTT connected!");

  mqttClient.subscribe("051_428_475/esp/change_pw/res", (err) => {
    if (!err) console.log("Subscribed: 051_428_475/esp/change_pw/res");
  });

  mqttClient.subscribe("051_428_475/esp/nfc-failed", (err) => {
    if (!err) console.log("Subscribed: 051_428_475/esp/nfc-failed");
  });
  mqttClient.subscribe("051_428_475/esp/keypad-failed", (err) => {
    if (!err) console.log("Subscribed: 051_428_475/esp/keypad-failed");
  });
  mqttClient.subscribe("051_428_475/esp/loitering-detected", (err) => {
    if (!err) console.log("Subscribed: 051_428_475/esp/loitering-detected");
  });
  
  // Subscribe to door status and action topics
  mqttClient.subscribe("051_428_475/esp/door_status", (err) => {
    if (!err) console.log("Subscribed: 051_428_475/esp/door_status");
  });
  
  mqttClient.subscribe("051_428_475/esp/door_action", (err) => {
    if (!err) console.log("Subscribed: 051_428_475/esp/door_action");
  });
});

// Hàm publish cho Controller dùng
export const publishToEsp = (topic, msg) => {
  mqttClient.publish(topic, msg);
};

export default mqttClient;
