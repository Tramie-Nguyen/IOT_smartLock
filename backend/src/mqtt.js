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

  // Gửi cho FE qua socket
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
});

// Hàm publish cho Controller dùng
export const publishToEsp = (topic, msg) => {
  mqttClient.publish(topic, msg);
};

export default mqttClient;
