#include <Arduino.h>

#include <WiFi.h>
#include <PubSubClient.h>

#include <ESP32Servo.h>
#include <LiquidCrystal_I2C.h>
#include <Keypad.h>
#include <Password.h>

#define servoPin 33
Servo servo;

LiquidCrystal_I2C lcd(0x27, 16, 2);

const char* ssid = "Wokwi-GUEST";
const char* wifiPassword = "";

// MQTT server
const char* mqttServer = "broker.hivemq.com";
int port = 1883;

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

// ===============================
// KẾT NỐI WIFI
// ===============================
void wifiConnect() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, wifiPassword);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" Connected!");
}

// ===============================
// KẾT NỐI MQTT
// ===============================
void mqttConnect() {
  while (!mqttClient.connected()) {
    Serial.println("Attempting MQTT connection...");
    String clientId = "ESP32Client-" + String(random(0xffff), HEX);

    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("MQTT connected");

      // Subscribe topic
      mqttClient.subscribe("/MSSV/led");
    } else {
      Serial.print("Failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

// ===============================
// CALLBACK – khi có dữ liệu gửi về
// ===============================
void callback(char* topic, byte* message, unsigned int length) {
  Serial.print("Topic: ");
  Serial.println(topic);

  String msg = "";
  for (int i = 0; i < length; i++) {
    msg += (char)message[i];
  }
  Serial.print("Message: ");
  Serial.println(msg);

  // Xử lý dữ liệu MQTT nhận về
  //...
}

int red = 16;
int wrongPw = 0;
int blue = 17;
int green = 23;
bool isDoorLocked = false; // khi sai mật khẩu 5 lần liên tục

// các biến quản lý chức năng đổi mật khẩu
unsigned long keyPressStart = 0;
unsigned long holdTimeRequired = 3000;
bool isChangingPass = false;

// quản lý keypad
const byte ROWS = 4;
const byte COLS = 4;

char keys[ROWS][COLS] =
{
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '#', 'D'},
};

byte rowPins[ROWS] = {5, 18, 19, 25};
byte colPins[COLS] = {26, 34, 35, 32};
String initualPW = "123456";
Password password = Password((char*)initualPW.c_str());

Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

//PROTOTYPE
String readPasswordFromKeypad();
void handleChangePw();
void handleDoorInput(char key);
void lockDoor();
void unlockFromApp();
void changeFail(String first, String second);
void changeSuccess();
void showHomeScreen();


void setup() {
  wifiConnect();

  mqttClient.setServer(mqttServer, port);
  mqttClient.setCallback(callback);
  mqttClient.setKeepAlive(90);

  pinMode(red, OUTPUT);
  pinMode(blue, OUTPUT);
  pinMode(green, OUTPUT);

  servo.attach(servoPin);
  lcd.init();
  lcd.backlight();
  showHomeScreen();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    wifiConnect();
  }
  if (!mqttClient.connected()) {
    mqttConnect();
  }

  mqttClient.loop();

  // Publish thử dữ liệu
  char buffer[10];
  sprintf(buffer, "%d", random(0, 100));
  mqttClient.publish("/MSSV/temperature", buffer);

  delay(3000);
  
  char key = keypad.getKey();
  // nếu cửa khóa do nhập sai nhiều lần
  if (isDoorLocked){
    lockDoor();
    return;
  }

  // bắt đầu giữ #
  if (key == '#' && !isChangingPass) {
    isChangingPass = true;
    keyPressStart = millis();
  }

  // nếu nhả phím trước khi đủ thời gian -> hủy chế độ hold
  if (key == NO_KEY && isChangingPass) {
    // giữ trạng thái chờ, nhưng ta sẽ bỏ cờ nếu chưa đủ thời gian
    if (millis() - keyPressStart < holdTimeRequired) {
      isChangingPass = false;
    }
  }

  // giữ đủ thời gian -> kích hoạt mode đổi mật khẩu
  if (isChangingPass && (millis() - keyPressStart >= holdTimeRequired)) {
    isChangingPass = false;
    handleChangePw();
  }

  // xử lý nhập mật khẩu -> mở cửa
  if (key != NO_KEY) 
      handleDoorInput(key);
    
  
}

// hàm đọc mật khẩu từ keypad
// - dùng '*' để xóa ký tự cuối
String readPasswordFromKeypad() {

  String input = "";
  lcd.setCursor(0, 1);
  lcd.print(">"); // dòng nhập
  
  while (true) {
    char k = keypad.getKey();
    if (k != NO_KEY) {
      if (k == '*') { // backspace
        if (input.length() > 0) {
          input.remove(input.length() - 1);
          // cập nhật hiển thị
          lcd.setCursor(1, 1);
          // hiển thị dấu '*' cho mỗi ký tự
          for (int i = 0; i < input.length(); ++i) lcd.print('*');
          // xóa phần thừa
          lcd.print("                ");
          lcd.setCursor(1 + input.length(), 1);
          
        }
      } else if (k == '#') { // submit
        delay(200); // debounce
        return input;
      } else {
        // chỉ chấp nhận số (bổ sung nếu muốn chấp nhận chữ)
        if (input.length() < 16) {
          input += k;
          lcd.print('*');
          
        }
      }
      // nhỏ delay để tránh quá nhanh
      delay(120);
    }
  }
}

// đổi mật khẩu: workflow: nhập mật khẩu cũ -> nhập mật khẩu mới -> xác nhận -> lưu
void handleChangePw() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Doi mat khau");
  lcd.setCursor(0, 1);
  lcd.print("Nhap mat khau cu");

  String enteredOld = readPasswordFromKeypad();
  Password enteredPw((char*)enteredOld.c_str());

  lcd.clear();
  if (enteredPw.evaluate()) {
    // nhập mật khẩu mới
    lcd.setCursor(0, 0);
    lcd.print("Nhap mat khau moi");
    lcd.setCursor(0, 1);
    String new1 = readPasswordFromKeypad();

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Xac nhan moi");
    lcd.setCursor(0, 1);
    String new2 = readPasswordFromKeypad();

    if (new1.length() == 0) {
      changeFail("Mat khau moi", "khong duoc rong");
      return;
    }

    if (new1 == new2) {
      // cập nhật password object
      password = Password((char*) new1.c_str());
      changeSuccess();
    } else {
      changeFail("Xac nhan", "khong khop");
    }
  } else {
    changeFail("Mat khau cu", "khong dung");
    wrongPw++;
    if (wrongPw >= 5) {
      isDoorLocked = true;
      lockDoor();
      return;
    }
  }
}

void handleDoorInput(char key) {
  String currentInput = "";
  // khi người dùng nhấn phím:
  if (key == '*') { // xóa
    if (currentInput.length() > 0) currentInput.remove(currentInput.length() - 1);
    // cập nhật LCD (dễ hiểu)
    lcd.setCursor(0, 1);
    lcd.print("                ");
    lcd.setCursor(0, 1);
    for (int i = 0; i < currentInput.length(); ++i) lcd.print('*');
    return;
  }

  if (key == '#') { // submit
    Password currentPw((char*)currentInput.c_str());
    if (currentPw.evaluate()) {
      // đúng mật khẩu -> mở cửa
      lcd.clear();
      lcd.setCursor(0,0);
      lcd.print("CHINH XAC!");
      digitalWrite(green, HIGH);
      servo.write(90);
      delay(3000);
      servo.write(0);
      digitalWrite(green, LOW);
      wrongPw = 0;
      currentInput = "";
      showHomeScreen();
    } else {
      // sai mật khẩu
      lcd.clear();
      lcd.setCursor(0,0);
      lcd.print("MAT KHAU SAI");
      digitalWrite(red, HIGH);
      delay(1000);
      digitalWrite(red, LOW);
      wrongPw++;
      currentInput = "";
      if (wrongPw >= 5) {
        isDoorLocked = true;
        lockDoor();
        return;
      }
      showHomeScreen();
    }
    return;
  }

  // nếu là phím số/ki tu bình thường -> thêm vào input
  if (key != NO_KEY) {
    // chỉ chấp nhận 0-9 (hoặc bạn có thể chấp nhận A-D)
    if (currentInput.length() < 16) {
      currentInput += key;
      lcd.setCursor(0,1);
      for (int i = 0; i < currentInput.length(); ++i) lcd.print('*');
    }
  }
}

void lockDoor() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("DA KHOA HE THONG");
  lcd.setCursor(0, 1);
  lcd.print("MO BANG APP");
  // nháy đỏ vài lần
  for (int i = 0; i < 4; ++i) {
    digitalWrite(red, HIGH);
    delay(300);
    digitalWrite(red, LOW);
    delay(300);
  }
}

void unlockFromApp() {
  isDoorLocked = false;
  wrongPw = 0;
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("APP UNLOCK OK");
  digitalWrite(blue, HIGH);
  delay(1000);
  digitalWrite(blue, LOW);
  showHomeScreen();
}

void changeFail(String first, String second) {
  lcd.clear();
  lcd.setCursor(0,0);
  lcd.print(first);
  lcd.setCursor(0,1);
  lcd.print(second);
  digitalWrite(red, HIGH);
  delay(1500);
  digitalWrite(red, LOW);
  showHomeScreen();
}

void changeSuccess() {
  lcd.clear();
  lcd.setCursor(0,0);
  lcd.print("Doi mat khau");
  lcd.setCursor(0,1);
  lcd.print("thanh cong");
  digitalWrite(blue, HIGH);
  delay(1500);
  digitalWrite(blue, LOW);
  showHomeScreen();
}



void showHomeScreen() {
  servo.write(0);
  // không reset wrongPw ở đây nếu bạn muốn giữ số lần sai; theo code gốc bạn reset -> mình giữ nguyên
  // wrongPw = 0;
  lcd.clear();
  lcd.setCursor(3, 0);
  lcd.print("KHOA CUA");
  lcd.setCursor(3, 1);
  lcd.print("THONG MINH");
  delay(1500);
  lcd.clear();
}
