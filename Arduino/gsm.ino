#include <SoftwareSerial.h>


SoftwareSerial gsmCall(6, 7);   
SoftwareSerial gsmSOS(8, 9);    

String incoming = "";

void setup() {
  Serial.begin(9600);       
  gsmCall.begin(9600);      
  gsmSOS.begin(9600);       
  delay(2000);
  
  Serial.println("System ready. Waiting for commands...");
}

void loop() {
  
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      handleCommand(incoming);
      incoming = "";
    } else {
      incoming += c;
    }
  }
}


void handleCommand(String cmd) {
  cmd.trim();
  Serial.println("Received: " + cmd);

  if (cmd.startsWith("CALL:")) {
    String number = cmd.substring(5);
    callNumber(number);
  } else if (cmd.startsWith("SOS:")) {
    String numbers = cmd.substring(4);
    sendSOS(numbers);
  } else {
    Serial.println("Unknown command format.");
  }
}


void callNumber(String number) {
  Serial.println("Calling number: " + number);
  gsmCall.println("AT");
  delay(500);
  gsmCall.println("ATD+" + number + ";");
  delay(10000); 
  gsmCall.println("ATH"); 
}


void sendSOS(String csvNumbers) {
  int start = 0;
  int commaIndex = csvNumbers.indexOf(',');
  while (commaIndex != -1) {
    String number = csvNumbers.substring(start, commaIndex);
    alertUser(number);
    start = commaIndex + 1;
    commaIndex = csvNumbers.indexOf(',', start);
  }
  
  String number = csvNumbers.substring(start);
  alertUser(number);
}


void alertUser(String number) {
  Serial.println("Sending SOS to: " + number);

  
  gsmSOS.println("AT+CMGF=1"); 
  delay(500);
  gsmSOS.print("AT+CMGS=\"+");
  gsmSOS.print(number);
  gsmSOS.println("\"");
  delay(500);

  gsmSOS.print("URGENT: Patient is in danger. Immediate attention needed at their location!");
  gsmSOS.write(26); 
  delay(3000);

  
  gsmSOS.println("AT");
  delay(500);
  gsmSOS.println("ATD+" + number + ";");
  delay(10000); 
  gsmSOS.println("ATH"); 
}
