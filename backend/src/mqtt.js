import mqtt from "mqtt";

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
});

// Hàm publish cho Controller dùng
export const publishToEsp = (topic, msg) => {
  mqttClient.publish(topic, msg);
};

export default mqttClient;
