#include <Arduino.h>

#include <LiquidCrystal_I2C.h>
#include <Keypad.h>
#include <ESP32Servo.h>

#define servoPin 33
Servo servo;

LiquidCrystal_I2C lcd(0x27, 16, 2);

int red = 16;
int wrongPw = 0;
int blue = 17;
int green = 23;
int relay = 27;
bool isDoorLocked = false;

// các biến quản lý chức năng đổi mật khẩu
unsigned long keyPressStart = 0;
unsigned long holdTimeRequired = 3000;
bool isHoldingHash = false;

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
byte colPins[COLS] = {26, 4, 2, 32};
String initualPW = "123456";
String currentInput = "";
bool isEnteringDoorPassword = false;

Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

// PROTOTYPE
String readPasswordFromKeypad();
void handlePasswordCheck(String password);
void lockDoor();
void unlockFromApp();
void handleChangePw();
void changeFail(String first, String second);
void changeSuccess();
void showHomeScreen();
void printAndOpenDoor();


void setup() {
  Serial.begin(115200);
  Serial.println("--- KHOI DONG HE THONG ---");
  pinMode(red, OUTPUT);
  pinMode(blue, OUTPUT);
  pinMode(green, OUTPUT);
  pinMode(relay, OUTPUT);

  servo.attach(servoPin);

  lcd.init();
  lcd.backlight();
  showHomeScreen();
}

void loop() {
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

  // ============================
  //  Xử lý nhập mật khẩu mở cửa
  // ============================
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
  lcd.print("Nhap mat khau moi:");
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
    printAndOpenDoor();
  } else {
    lcd.clear();
    lcd.setCursor(0,0);
    lcd.print("MAT KHAU SAI");
    digitalWrite(red, HIGH);
    delay(1000);
    digitalWrite(red, LOW);

    if (password.length() > 0) wrongPw++;

    if (wrongPw >= 5) {
      isDoorLocked = true;
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
  lcd.clear();
  lcd.setCursor(4,0);
  lcd.print("CUA MO");
  lcd.setCursor(2,1);
  lcd.print("THANH CONG!");
  digitalWrite(green, HIGH);
  servo.write(90);
  digitalWrite(relay, HIGH);
  delay(3000);
  servo.write(0);
  digitalWrite(green, LOW);
  digitalWrite(relay, LOW);
  wrongPw = 0;
  showHomeScreen();
}

void unlockFromApp() {
  // isDoorLocked = false;
  // wrongPw = 0;
  // lcd.clear();
  // lcd.setCursor(0, 0);
  // lcd.print("MO KHOA BANG APP");
  // digitalWrite(green, HIGH);
  // delay(1000);
  // digitalWrite(green, LOW);
  // showHomeScreen();
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
  digitalWrite(blue, HIGH);
  delay(1500);
  digitalWrite(blue, LOW);
  showHomeScreen();
}

void showHomeScreen() {
  servo.write(0);
  lcd.clear();
  lcd.setCursor(3, 0);
  lcd.print("KHOA CUA");
  lcd.setCursor(3, 1);
  lcd.print("THONG MINH");
  delay(2000);
  lcd.clear();
}
