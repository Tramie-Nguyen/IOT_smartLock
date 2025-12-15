#include <Arduino.h>

#include <LiquidCrystal_I2C.h>
#include <Keypad.h>

#include <WiFi.h>
#include <PubSubClient.h>

#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

const char* ssid = "Mit";
const char* password = "27072005";

String teamKey = "051_428_475";

const char* mqtt_server = "broker.hivemq.com";
int port = 1883;

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

//RFID
#define SS_PIN 5
#define RST_PIN 13

MFRC522 mfrc522(SS_PIN, RST_PIN);
//String uid1 = "51 a5 12 6";
String uid2 = "71 1 47 17";

LiquidCrystal_I2C lcd(0x27, 16, 2);

int red = 15;
int wrongPw = 0;
int greenLedAndRelay = 14; 

// cờ check cửa có bị khóa do người dùng nhập sai 5 lần hay không
bool isDoorLocked = false;
int nfcFailed = 0;

// các biến giám sát khoảng cách
int trig = 27;
int echo = 35; 
bool isSomeoneDetected = false;         
unsigned long nearStartTime = 0;        
bool isNear = false;    

const int NEAR_THRESHOLD = 20;         
const unsigned long NEAR_DURATION = 5000;

// các biến quản lý chức năng đổi mật khẩu
unsigned long keyPressStart = 0;
unsigned long holdTimeRequired = 3000;
bool isHoldingHash = false;

// quản lý keypad
const byte ROWS = 4;
const byte COLS = 3;

char keys[ROWS][COLS] =
{
  {'1', '2', '3'},
  {'4', '5', '6'},
  {'7', '8', '9'},
  {'*', '0', '#'},
};

byte rowPins[ROWS] = {0, 4, 16, 17};
byte colPins[COLS] = {32, 33, 25}; 
String initualPW = "123456";
String currentInput = "";
bool isEnteringDoorPassword = false;

Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

void wifiConnect() {
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.println("Attemping WiFi connection...");
  }
  Serial.println("Wifi connected!");
}

void mqttConnect() {
  while(!mqttClient.connected()) {
    Serial.println("Attemping MQTT connection...");
    String clientId = "ESP32Client-" + String(random(0xffff), HEX); // random để tránh trùng ID
    if(mqttClient.connect(clientId.c_str())) {
      Serial.println("MQTT connected");

      //***Subscribe all topic you need***
      mqttClient.subscribe((teamKey + "/esp/change_pw").c_str());
    }
    else {
      Serial.print(mqttClient.state());
      Serial.println("try again in 5 seconds");
      delay(5000);
    }
  }
}

//MQTT Receiver
void callback(char* topic, byte* message, unsigned int length) {
  Serial.println(topic);
  String msg;
  for(int i=0; i<length; i++) {
    msg += (char)message[i];
  }
  Serial.println(msg);

  //***Code here to process the received package***
  if (String(topic) == (teamKey + "/esp/change_pw").c_str()) {
    handleChangePWFromWeb(msg);
  }

}

void checkRFID() {
  if (!mfrc522.PICC_IsNewCardPresent()) return;// kiểm tra có thẻ mới không
  if (!mfrc522.PICC_ReadCardSerial()) return;// kiểm tra đọc thẻ thành công không

  // Lấy UID
  String uid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    uid += String(mfrc522.uid.uidByte[i], HEX);
    uid += " ";
  }
  uid.trim(); // bỏ space cuối

  Serial.print("RFID UID: ");
  Serial.println(uid);

  // so sánh UID
  if (uid == uid2) {
    Serial.println("The hop le -> Mo cua!");
    mqttClient.publish((teamKey + "/esp/nfc-success").c_str(), "SUCCESS");
    printAndOpenDoor();
  } else {
    Serial.println("The khong hop le!");
    nfcFailed += 1;
    if(nfcFailed >= 5) {
      Serial.println("NFC sai qua 5 lan");
      mqttClient.publish((teamKey + "/esp/nfc-failed").c_str(), String(nfcFailed).c_str());
    }
    digitalWrite(red, HIGH);
    delay(500);
    digitalWrite(red, LOW);
  }

  // dừng đọc thẻ cũ
  mfrc522.PICC_HaltA();
  // tắt mã hóa
  mfrc522.PCD_StopCrypto1();
}

void handleChangePWFromWeb(String msg) {
  Serial.println("Handling change password from web...");

  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, msg);

  if (error) {
    Serial.println("JSON parse FAILED");
    return;
  }

  String oldPW = doc["oldPW"].as<String>();
  String newPW = doc["newPW"].as<String>();

  Serial.println("Old PW: " + oldPW);
  Serial.println("New PW: " + newPW);

  if (oldPW != initualPW) {
    Serial.println("Wrong old password!");
    mqttClient.publish((teamKey + "/esp/change_pw/res").c_str(), "WRONG_OLD_PASSWORD");
    changeFail("Sai mat khau cu", "");
    return;
  }

  initualPW = newPW;
  Serial.println("Password changed successfully!");
  mqttClient.publish((teamKey + "/esp/change_pw/res").c_str(), "SUCCESS");
  changeSuccess();
}



void setup() {
  Serial.begin(115200);
  Serial.println("--- KHOI DONG HE THONG ---");

  pinMode(red, OUTPUT);
  pinMode(greenLedAndRelay, OUTPUT);
  pinMode(echo, INPUT);
  pinMode(trig, OUTPUT);

  SPI.begin(18, 19, 23);      // SCK=18, MISO=19, MOSI=23
  mfrc522.PCD_Init();
  Serial.println("Quet the RC522...");

  wifiConnect();
  mqttClient.setServer(mqtt_server, port);
  mqttClient.setCallback(callback);
  mqttClient.setKeepAlive( 90 );

  lcd.init();
  lcd.backlight();
  showHomeScreen();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Reconnecting to WiFi...");
    wifiConnect();
  }
  if(!mqttClient.connected()) {
    Serial.println("Reconnecting to MQTT...");
    mqttConnect();
  }
  mqttClient.loop();

  checkRFID();

  updateDistanceWatcher();

  char key = keypad.getKey();
  KeyState state = keypad.getState();   // <<=== LẤY TRẠNG THÁI PHÍM

  // nếu cửa khóa
  if (isDoorLocked){
    lcd.setCursor(0, 0);
    lcd.print("DA KHOA HE THONG");
    lcd.setCursor(0, 1);
    lcd.print("MO BANG APP");
    return;
  }

  // 1. Khi bắt đầu bấm #
  if (key == '#' && state == PRESSED && !isHoldingHash && !isEnteringDoorPassword) {
    isHoldingHash = true;
    keyPressStart = millis();
    Serial.println("Bat dau GIU #");
  }

  // 2. Khi đang giữ phím #
  if (isHoldingHash && state == HOLD) {
    unsigned long holdDuration = millis() - keyPressStart;

    //kích hoạt đổi mật khẩu nếu đủ thời gian quy định
    if (holdDuration >= holdTimeRequired) {
      isHoldingHash = false;
      Serial.println("BAT DAU QUA TRINH DOI MAT KHAU");
      handleChangePw();
      return;
    }
  }

  // 3. Khi nhả phím #
  if (isHoldingHash && state == RELEASED) {
    unsigned long holdDuration = millis() - keyPressStart;
    isHoldingHash = false;

    if (holdDuration < holdTimeRequired) {
      Serial.println("Nha # som -> HUY doi mat khau");
    }
  }

  // 4. Nếu đang theo dõi mà user bấm phím khác → Hủy
  if (isHoldingHash && key != '#' && key != NO_KEY) {
    isHoldingHash = false;
    Serial.println("Nhan phim khac -> Huy GIU #");
  }

  //Xử lý nhập mật khẩu cửa
  if (key != NO_KEY) {

    if (isHoldingHash && key == '#') return;

    if (currentInput.length() == 0 && key != '#' && key != '*') {
      isEnteringDoorPassword = true;
      lcd.clear();
      lcd.setCursor(0,0);
      lcd.print("Nhap mat khau:");
      lcd.setCursor(0,1);
    }

    if (key == '*') {
      if (currentInput.length() > 0) {
        currentInput.remove(currentInput.length() - 1);
        lcd.setCursor(currentInput.length(), 1);
        lcd.print(" ");
        lcd.setCursor(currentInput.length(), 1);

        if (currentInput.length() == 0) {
          isEnteringDoorPassword = false;
          showHomeScreen();
        }
      }
    } else if (key == '#') {
      handlePasswordCheck(currentInput);
      currentInput = "";
      isEnteringDoorPassword = false;
    } else {
      if (currentInput.length() < 16) {
        currentInput += key;
        lcd.setCursor(currentInput.length() - 1, 1);
        lcd.print('*');
      }
    }
    delay(120);
  }
}

void handleChangePw() {
  keypad.getKey();

  lcd.clear();
  lcd.setCursor(0,0);
  lcd.print("Nhap mat khau cu");
  lcd.setCursor(0,1);
  lcd.print(">");

  String oldPw = readPasswordFromKeypad();

  if (oldPw != initualPW) {
    changeFail("Sai mat khau cu", "Doi that bai");
    return;
  }

  lcd.clear();
  lcd.setCursor(0,0);
  lcd.print("Nhap mk moi:");
  lcd.setCursor(0,1);
  lcd.print(">");

  String newPw = readPasswordFromKeypad();
  if(newPw.length() == 0){
      changeFail("Mat khau khong", "duoc de trong");
      return;
  }
  if (newPw.length() < 4) {
    changeFail("Toi thieu 4 ky tu", "Vui long thu lai");
    return;
  }
  
  lcd.clear();
  lcd.setCursor(0,0);
  lcd.print("Nhap lai mk moi");
  lcd.setCursor(0,1);
  lcd.print(">");

  String newPw2 = readPasswordFromKeypad();

  if (newPw != newPw2) {
    changeFail("Khong trung khop", "");
    return;
  }

  initualPW = newPw;
  // mqttClient.publish((teamKey + "/esp/keypad-changePw").c_str(), initialPW.c_str());
  changeSuccess();
}

String readPasswordFromKeypad() {

  String input = "";
  lcd.setCursor(1, 1);
  
  while (true) {
    char k = keypad.getKey();
    
    if (k != NO_KEY) {
      if (k == '*') {
        if (input.length() > 0) {
          input.remove(input.length() - 1);
          lcd.setCursor(1, 1);
          for (int i = 0; i < input.length(); ++i) lcd.print('*');
          lcd.print("                ");
          lcd.setCursor(1 + input.length(), 1);
        }
      } else if (k == '#') {
        delay(200);
        return input;
      } else {
        if (input.length() < 16) {
          input += k;
          lcd.print('*');
        }
      }
      delay(120);
    }
  }
}

void handlePasswordCheck(String password) {
  
  if (password == initualPW && password.length() > 0) {
    mqttClient.publish((teamKey + "/esp/keypad-success").c_str(), "SUCCESS");
    printAndOpenDoor();
  } else {
    lcd.clear();
    lcd.setCursor(0,0);
    lcd.print("MAT KHAU SAI");
    digitalWrite(red, HIGH);
    delay(1000);
    digitalWrite(red, LOW);

    if (password.length() > 0) {
      wrongPw++;
    }
    if (wrongPw >= 5) {
      isDoorLocked = true;
      mqttClient.publish((teamKey + "/esp/keypad-failed").c_str(), String(wrongPw).c_str());
      lockDoor();
      return;
    }
    showHomeScreen();
  }
}

void lockDoor() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("DA KHOA HE THONG");
  lcd.setCursor(0, 1);
  lcd.print("MO BANG APP");
  for (int i = 0; i < 4; ++i) {
    digitalWrite(red, HIGH);
    delay(300);
    digitalWrite(red, LOW);
    delay(300);
  }
}

void printAndOpenDoor(){
  //relay, servo
  nfcFailed = 0;
  lcd.clear();
  lcd.setCursor(4,0);
  lcd.print("CUA MO");
  lcd.setCursor(2,1);
  lcd.print("THANH CONG!");
  digitalWrite(greenLedAndRelay, HIGH);
  delay(3000);
  digitalWrite(greenLedAndRelay, LOW);
  wrongPw = 0;
  showHomeScreen();
}

int getDistanceCm(){
  digitalWrite(trig, LOW);
  delayMicroseconds(2);
  digitalWrite(trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig, LOW);

  int getTime = pulseIn(echo, HIGH);
  int distance = 0.034 * getTime  / 2;
  return distance;
}

void updateDistanceWatcher() {
  // Nếu đang có thao tác → không truy cập logic này
  if (isEnteringDoorPassword || isHoldingHash) {
    isNear = false;
    nearStartTime = 0;
    return;
  }

  int d = getDistanceCm();

  // Nếu có người gần hơn ngưỡng
  if (d > 0 && d < NEAR_THRESHOLD) {
    if (!isNear) {
      isNear = true;
      nearStartTime = millis();  // bắt đầu tính giờ
    } else {
      // Đã trong trạng thái gần → kiểm tra đủ 5s chưa
      if (!isSomeoneDetected && millis() - nearStartTime >= NEAR_DURATION) {
        isSomeoneDetected = true;
        Serial.println("Phat hien nguoi dung truoc cua !");
        
        // gửi tín hiệu topic cho MQTT
        mqttClient.publish((teamKey + "/esp/loitering-detected").c_str(), "An unknown person has been standing in front of the door for an extended period of time");
      }
    }
  }
  else {
    // Không gần nữa → reset
    isNear = false;
    nearStartTime = 0;
    isSomeoneDetected = false;
  }
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
  lcd.print("DOI MAT KHAU");
  lcd.setCursor(0,1);
  lcd.print("THANH CONG");
  delay(1500);
  showHomeScreen();
}

void showHomeScreen() {
  lcd.clear();
  lcd.setCursor(3, 0);
  lcd.print("KHOA CUA");
  lcd.setCursor(3, 1);
  lcd.print("THONG MINH");
  delay(2000);
  lcd.clear();
}