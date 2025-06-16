#include <SoftwareSerial.h>

SoftwareSerial gsmCall(6, 7);   
SoftwareSerial gsmSOS(8, 9);    

String incoming = "";
bool callActive = false;
bool sosActive = false;
unsigned long callStartTime = 0;
const unsigned long MAX_CALL_DURATION = 120000; // 2 minutes max call duration
const unsigned long CALL_TIMEOUT = 30000; // 30 seconds to connect

void setup() {
  Serial.begin(9600);       
  gsmCall.begin(9600);      
  gsmSOS.begin(9600);       
  delay(2000);
  
  // Initialize GSM modules
  initializeGSM();
  
  Serial.println("System ready. Waiting for commands...");
}

void initializeGSM() {
  Serial.println("Initializing GSM modules...");
  
  // Initialize Call GSM module
  gsmCall.println("AT");
  delay(1000);
  
  // Set audio path to handset (use built-in speaker and mic)
  gsmCall.println("AT+CHFA=1"); // Enable hands-free audio
  delay(500);
  
  // Set speaker volume (0-9, 5 is medium)
  gsmCall.println("AT+CLVL=7"); // Set speaker volume to 7
  delay(500);
  
  // Set microphone gain (0-15, 8 is medium)
  gsmCall.println("AT+CMIC=0,10"); // Set mic gain to 10
  delay(500);
  
  // Enable call progress notifications
  gsmCall.println("AT+COLP=1"); // Connected line identification
  delay(500);
  
  // Initialize SOS GSM module
  gsmSOS.println("AT");
  delay(1000);
  
  // Set SMS format to text mode
  gsmSOS.println("AT+CMGF=1");
  delay(500);
  
  // Set audio path for SOS calls
  gsmSOS.println("AT+CHFA=1"); // Enable hands-free audio
  delay(500);
  gsmSOS.println("AT+CLVL=7"); // Set speaker volume
  delay(500);
  gsmSOS.println("AT+CMIC=0,10"); // Set mic gain
  delay(500);
  
  Serial.println("GSM modules initialized");
}

void loop() {
  // Handle incoming serial commands
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      handleCommand(incoming);
      incoming = "";
    } else {
      incoming += c;
    }
  }
  
  // Monitor active calls
  if (callActive) {
    monitorCall();
  }
  
  if (sosActive) {
    monitorSOSCall();
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
  } else if (cmd == "HANGUP" || cmd == "END_CALL") {
    if (callActive) {
      hangupCall();
    } else if (sosActive) {
      hangupSOSCall();
    } else {
      Serial.println("No active call to hang up");
    }
  } else if (cmd == "STATUS") {
    reportStatus();
  } else if (cmd.startsWith("VOLUME:")) {
    int volume = cmd.substring(7).toInt();
    setVolume(volume);
  } else if (cmd.startsWith("MIC:")) {
    int micGain = cmd.substring(4).toInt();
    setMicGain(micGain);
  } else {
    Serial.println("Unknown command format.");
    Serial.println("Available commands:");
    Serial.println("  CALL:<number> - Make a call");
    Serial.println("  SOS:<number> - Send emergency SMS + call");
    Serial.println("  HANGUP - End current call");
    Serial.println("  STATUS - Check call status");
    Serial.println("  VOLUME:<0-9> - Set speaker volume");
    Serial.println("  MIC:<0-15> - Set microphone gain");
  }
}

void reportStatus() {
  Serial.println("=== GSM Status ===");
  Serial.println("Call active: " + String(callActive ? "YES" : "NO"));
  Serial.println("SOS active: " + String(sosActive ? "YES" : "NO"));
  
  if (callActive || sosActive) {
    unsigned long duration = (millis() - callStartTime) / 1000;
    Serial.println("Call duration: " + String(duration) + " seconds");
  }
  
  // Check GSM module status
  gsmCall.println("AT+CREG?"); // Network registration
  delay(500);
  if (gsmCall.available()) {
    Serial.println("Network: " + gsmCall.readString());
  }
  
  gsmCall.println("AT+CSQ"); // Signal quality
  delay(500);
  if (gsmCall.available()) {
    Serial.println("Signal: " + gsmCall.readString());
  }
}

void setVolume(int volume) {
  volume = constrain(volume, 0, 9);
  Serial.println("Setting speaker volume to: " + String(volume));
  
  gsmCall.println("AT+CLVL=" + String(volume));
  gsmSOS.println("AT+CLVL=" + String(volume));
  delay(500);
}

void setMicGain(int gain) {
  gain = constrain(gain, 0, 15);
  Serial.println("Setting microphone gain to: " + String(gain));
  
  gsmCall.println("AT+CMIC=0," + String(gain));
  gsmSOS.println("AT+CMIC=0," + String(gain));
  delay(500);
}


void callNumber(String number) {
  if (callActive) {
    Serial.println("Call already in progress");
    return;
  }
  
  Serial.println("Initiating call to: " + number);
  
  // Enable hands-free mode and set audio levels
  gsmCall.println("AT+CHFA=1"); // Enable hands-free
  delay(500);
  gsmCall.println("AT+CLVL=7"); // Set speaker volume
  delay(500);
  
  // Initiate call
  gsmCall.println("ATD+" + number + ";");
  callStartTime = millis();
  callActive = true;
  
  Serial.println("Call initiated - waiting for connection...");
  Serial.println("Audio will be routed through GSM module speaker/microphone");
}

void monitorCall() {
  // Check for call timeout
  if (millis() - callStartTime > CALL_TIMEOUT && !isCallConnected()) {
    Serial.println("Call timeout - hanging up");
    hangupCall();
    return;
  }
  
  // Check for maximum call duration
  if (millis() - callStartTime > MAX_CALL_DURATION) {
    Serial.println("Maximum call duration reached - hanging up");
    hangupCall();
    return;
  }
  
  // Check for incoming responses from GSM module
  if (gsmCall.available()) {
    String response = gsmCall.readString();
    response.trim();
    Serial.println("Call status: " + response);
    
    if (response.indexOf("CONNECT") >= 0 || response.indexOf("COLP") >= 0) {
      Serial.println("✓ Call connected! Audio active through GSM speaker/mic");
    } else if (response.indexOf("NO CARRIER") >= 0 || 
               response.indexOf("BUSY") >= 0 || 
               response.indexOf("NO ANSWER") >= 0) {
      Serial.println("Call ended or failed: " + response);
      callActive = false;
    }
  }
  
  // Check for hang up command via serial
  if (Serial.available()) {
    String cmd = Serial.readString();
    cmd.trim();
    if (cmd == "HANGUP" || cmd == "END_CALL") {
      Serial.println("Manual hangup requested");
      hangupCall();
    }
  }
}

void hangupCall() {
  Serial.println("Hanging up call...");
  gsmCall.println("ATH");
  delay(500);
  callActive = false;
  Serial.println("Call ended");
}

bool isCallConnected() {
  gsmCall.println("AT+CPAS"); // Check phone activity status
  delay(100);
  
  if (gsmCall.available()) {
    String response = gsmCall.readString();
    // CPAS responses: 0=ready, 2=unknown, 3=ringing, 4=call in progress
    if (response.indexOf("+CPAS: 4") >= 0) {
      return true; // Call in progress
    }
  }
  return false;
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

  // First send SMS
  gsmSOS.println("AT+CMGF=1"); 
  delay(500);
  gsmSOS.print("AT+CMGS=\"+");
  gsmSOS.print(number);
  gsmSOS.println("\"");
  delay(500);

  gsmSOS.print("URGENT: Patient is in danger. Immediate attention needed at their location!");
  gsmSOS.write(26); 
  delay(3000);

  Serial.println("SMS sent, now initiating emergency call...");
  
  // Then initiate call with audio support
  gsmSOS.println("AT+CHFA=1"); // Enable hands-free
  delay(500);
  gsmSOS.println("AT+CLVL=9"); // Maximum volume for emergency
  delay(500);
  gsmSOS.println("AT+CMIC=0,15"); // Maximum mic gain for emergency
  delay(500);
  
  gsmSOS.println("ATD+" + number + ";");
  sosActive = true;
  callStartTime = millis();
  
  Serial.println("Emergency call initiated - audio active through GSM speaker/mic");
}

void monitorSOSCall() {
  // Check for call timeout
  if (millis() - callStartTime > CALL_TIMEOUT && !isSOSCallConnected()) {
    Serial.println("Emergency call timeout - hanging up");
    hangupSOSCall();
    return;
  }
  
  // Emergency calls can be longer (3 minutes)
  if (millis() - callStartTime > 180000) {
    Serial.println("Maximum emergency call duration reached - hanging up");
    hangupSOSCall();
    return;
  }
  
  // Check for responses from SOS GSM module
  if (gsmSOS.available()) {
    String response = gsmSOS.readString();
    response.trim();
    Serial.println("Emergency call status: " + response);
    
    if (response.indexOf("CONNECT") >= 0 || response.indexOf("COLP") >= 0) {
      Serial.println("✓ Emergency call connected! Audio active through GSM speaker/mic");
    } else if (response.indexOf("NO CARRIER") >= 0 || 
               response.indexOf("BUSY") >= 0 || 
               response.indexOf("NO ANSWER") >= 0) {
      Serial.println("Emergency call ended or failed: " + response);
      sosActive = false;
    }
  }
}

void hangupSOSCall() {
  Serial.println("Hanging up emergency call...");
  gsmSOS.println("ATH");
  delay(500);
  sosActive = false;
  Serial.println("Emergency call ended");
}

bool isSOSCallConnected() {
  gsmSOS.println("AT+CPAS"); // Check phone activity status
  delay(100);
  
  if (gsmSOS.available()) {
    String response = gsmSOS.readString();
    if (response.indexOf("+CPAS: 4") >= 0) {
      return true; // Call in progress
    }
  }
  return false;
}
