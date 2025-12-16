import { db, serverTime } from "./firebase.js";
import mqtt from "mqtt";
import { pushNotification } from "./controller.js";

const mqttUrl = "mqtt://broker.hivemq.com:1883";

const options = {
  clientId: "backend_server_" + Date.now(),
  clean: true,
};

// Lưu trạng thái wifi cuối cùng
export let lastWifiStatus = {
  connected: false,
  ssid: null,
  timestamp: null,
};


const mqttClient = mqtt.connect(mqttUrl, options);

const storeLog = async (type, message, topic, logDetails) => {
  try {
    await db.collection("logs").add({
      type: type,
      message: message,
      topic: topic,
      action: logDetails.action,
      method: logDetails.method,
      timestamp: serverTime(),
    });
    console.log("Log stored successfully in Firestore.");
  } catch (error) {
    console.error("Error storing log in Firestore: ", error);
  }
};

// Khi nhận dữ liệu từ ESP
mqttClient.on("message", (topic, message) => {
  const msg = message.toString();
  console.log("MQTT Message:", topic, msg);

  // Khai báo biến cần thiết
  // chuẩn hóa thời gian
  const localTime = new Date().toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  let logMessage = "";
  let logDetails = { action: "", method: "" };

  if (topic === "051_428_475/esp/nfc-failed") {
    logMessage = `NFC authentication failed ${msg} times on Smart Lock at ${localTime}.`;
    logDetails = { action: "Alert", method: "NFC" };

    console.log(logMessage);
    pushNotification(logMessage);
    storeLog("NFC_FAILED", logMessage, topic, logDetails);
  } else if (topic === "051_428_475/esp/nfc-success") {
    logMessage = `NFC authentication succeeded on Smart Lock at ${localTime}.`;
    logDetails = { action: "Unlocked", method: "NFC" };

    console.log(logMessage);
    storeLog("NFC_SUCCESS", logMessage, topic, logDetails);
  } else if (topic === "051_428_475/esp/keypad-failed") {
    logMessage = `Keypad authentication failed ${msg} times on Smart Lock at ${localTime}.`;
    logDetails = { action: "Alert", method: "Keypad" };

    console.log(logMessage);
    pushNotification(logMessage);
    storeLog("KEYPAD_FAILED", logMessage, topic, logDetails);
  } else if (topic === "051_428_475/esp/keypad-success") {
    logMessage = `Keypad authentication succeeded on Smart Lock at ${localTime}.`;
    logDetails = { action: "Unlocked", method: "Keypad" };

    console.log(logMessage);
    storeLog("KEYPAD_SUCCESS", logMessage, topic, logDetails);
  } else if (topic === "051_428_475/esp/loitering-detected") {
    logMessage = `${msg} at ${localTime}.`;
    logDetails = { action: "Alert", method: "Loitering" };

    console.log(logMessage);
    pushNotification(logMessage);
    storeLog("LOITERING", logMessage, topic, logDetails);
  } else if (topic === "051_428_475/esp/door_status") {
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
  } else if (topic === "051_428_475/esp/door_action") {
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
  } else if (topic === "051_428_475/esp/wifi_connected") {
      console.log("WiFi connected:", msg);

      lastWifiStatus = {
        connected: true,
        ssid: msg,
        timestamp: localTime,
      };
  }

  // Gửi cho FE qua socket cho các topic khác
  if (global.io) {
    global.io.emit(topic, {
      message: logMessage || msg,
      rawPayload: msg,
      action: logDetails.action,
      method: logDetails.method,
      timestamp: localTime,
    });
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

  mqttClient.subscribe("051_428_475/esp/nfc-success", (err) => {
    if (!err) console.log("Subscribed: 051_428_475/esp/nfc-success");
  });

  mqttClient.subscribe("051_428_475/esp/keypad-failed", (err) => {
    if (!err) console.log("Subscribed: 051_428_475/esp/keypad-failed");
  });

  mqttClient.subscribe("051_428_475/esp/keypad-success", (err) => {
    if (!err) console.log("Subscribed: 051_428_475/esp/keypad-success");
  });

  mqttClient.subscribe("051_428_475/esp/loitering-detected", (err) => {
    if (!err) console.log("Subscribed: 051_428_475/esp/loitering-detected");
  });

  mqttClient.subscribe("051_428_475/esp/wifi_connected", (err) => {
    if (!err) console.log("Subscribed: 051_428_475/esp/wifi_connected");
  });
});

// Subscribe to door status and action topics
mqttClient.subscribe("051_428_475/esp/door_status", (err) => {
  if (!err) console.log("Subscribed: 051_428_475/esp/door_status");
});

mqttClient.subscribe("051_428_475/esp/door_action", (err) => {
  if (!err) console.log("Subscribed: 051_428_475/esp/door_action");
});
// hàm publish cho controller sử dụng
export const publishToEsp = (topic, msg) => {
  mqttClient.publish(topic, msg);
};

export default mqttClient;
