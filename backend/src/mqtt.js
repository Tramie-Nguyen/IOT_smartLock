import { db, serverTime } from "./firebase.js";
import mqtt from "mqtt";
import { pushNotification, sendDoorbellEmail } from "./controller.js";

const mqttUrl = "mqtt://broker.hivemq.com:1883";

const options = {
  clientId: "backend_server_" + Date.now(),
  clean: true,
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
mqttClient.on("message", async (topic, message) => {
  const msg = message.toString();
  console.log("MQTT Message:", topic, msg);

  // Khai báo biến cần thiết
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
  } else if (topic === "051_428_475/esp/keypad-failed") {
    console.log(
      `Keypad authentication failed ${msg} times on Smart Lock at ${new Date().toLocaleString(
        "vi-VN",
        { timeZone: "Asia/Ho_Chi_Minh" }
      )}.`
    );
    pushNotification(
      `Keypad authentication failed ${msg} times on Smart Lock at ${new Date().toLocaleString(
        "vi-VN",
        { timeZone: "Asia/Ho_Chi_Minh" }
      )}.`
    );
  } else if (topic === "051_428_475/esp/loitering-detected") {
    console.log(
      `${msg} at ${new Date().toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
      })}.`
    );
    pushNotification(
      `${msg} at ${new Date().toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
      })}.`
    );
  } else if (topic === "051_428_475/esp/door_status") {
    console.log("Door status update:", msg);
    // Parse door status and broadcast to frontend
    try {
      const statusData = JSON.parse(msg);
      if (global.io) {        
        // Emit door_action_complete for web interface actions
        if (statusData.status) {
          global.io.emit("door_action_complete", {
            success: true,
            action: statusData.status === "locked" ? "LOCK" : "UNLOCK",
            timestamp: statusData.timestamp
          });
        }
        
        // Emit door_unlocked for manual unlocks (RFID/keypad)
        if (statusData.status === "unlocked" && statusData.method === "manual") {
          global.io.emit("door_unlocked", {
            status: "unlocked",
            timestamp: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
            method: statusData.method || "manual"
          });
        }
      }
    } catch (error) {
      console.error("Error parsing door status:", error);
    }
  } else if (topic === "051_428_475/esp/doorbell") {
    console.log("DOORBELL TOPIC RECEIVED!");
    console.log("Topic:", topic);
    console.log("Message:", msg);
    
    const timestamp = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
    });
    
    logMessage = `Doorbell ringing at ${timestamp}.`;
    logDetails = { action: "Alert", method: "Doorbell" };
    
    console.log("Guest at the door!");
    console.log("Time:", timestamp);
    console.log("Message:", msg);
    
    // Send push notification
    console.log("Sending push notification...");
    pushNotification(logMessage);
    
    // Send email notification
    console.log(" Attempting to send doorbell email...");
    try {
      await sendDoorbellEmail(timestamp, msg);
      console.log("Doorbell email process completed");
    } catch (error) {
      console.error("Error in doorbell email process:", error);
    }
    
    // Store log
    console.log("Storing doorbell log...");
    storeLog("DOORBELL", logMessage, topic, logDetails);
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
  
  mqttClient.subscribe("051_428_475/esp/doorbell", (err) => {
    if (!err) console.log("Subscribed: 051_428_475/esp/doorbell");
  });

  // Subscribe to door status and action topics
  mqttClient.subscribe("051_428_475/esp/door_status", (err) => {
    if (!err) console.log("Subscribed: 051_428_475/esp/door_status");
  });

});
// hàm publish cho controller sử dụng
export const publishToEsp = (topic, msg) => {
  mqttClient.publish(topic, msg);
};

export default mqttClient;
