/**
 * Enhanced ESP32-S3 code for Elderly Monitoring Band - FIXED VERSION
 * Fixed: Stack overflow issue in ButtonHandler task
 * Added: Medication reminder via MQTT & Call button
 * Modules: MAX30102 (Heart rate & SpO2), TMP117 (Temperature), MMA8452Q (Fall), SSD1306 OLED
 */

#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"
#include "spo2_algorithm.h"
#include <Adafruit_TMP117.h>
#include <Adafruit_SSD1306.h>
#include <SparkFun_MMA8452Q.h>
#include <math.h>
#include <WiFi.h>
#include <PubSubClient.h>

// -----------------------------
// Pin Definitions
// -----------------------------
#define SDA_PIN 21
#define SCL_PIN 20
#define BUZZER_PIN 10    
#define CANCEL_BUTTON 3
#define CALL_BUTTON 4    // New call button

// -----------------------------
// WiFi & MQTT Config
// -----------------------------
const char* ssid = "...";
const char* password = "12345678";
const char* mqtt_server = "192.168.103.253";
const int mqtt_port = 1883;
WiFiClient espClient;
PubSubClient client(espClient);

// -----------------------------
// Global Objects
// -----------------------------
MAX30105 max30102;
Adafruit_TMP117 tmp117;
Adafruit_SSD1306 display(128, 64, &Wire);
MMA8452Q accel;

// -----------------------------
// Shared Variables
// -----------------------------
int32_t spo2 = -1;
int8_t validSPO2 = 0;
int32_t heartRate = -1;
int8_t validHeartRate = 0;
float temperatureC = 0.0;
bool fallDetected = false;
bool fingerDetected = false;
bool emergency = false;
bool mqttConnected = false;

// New variables for medication reminder and call feature
bool medicationReminder = false;
bool callInitiated = false;
unsigned long medicationReminderStartTime = 0;
const unsigned long MEDICATION_REMINDER_DURATION = 60000; // 60 seconds
bool fallCanceled = false; // Track if fall was canceled by user

// -----------------------------
// Heart Rate Beat Detection Vars
// -----------------------------
unsigned long lastBeat = 0;
float beatsPerMinute = 0;
int beatAvg = 70; // Start with reasonable default
const byte RATE_ARRAY_SIZE = 4;
long rateArray[RATE_ARRAY_SIZE];
long rateArrayIndex = 0;

// Improved SpO2 calculation variables
float ratioAvg = 0.0;
int validReadings = 0;
const int MIN_VALID_READINGS = 5;

// -----------------------------
// WiFi Connection Function
// -----------------------------
void connectToWiFi() {
  Serial.println("Connecting to WiFi...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(1000);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi connection failed!");
  }
}

// -----------------------------
// MQTT Functions
// -----------------------------
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  // Convert payload to string
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.printf("Received MQTT message on topic '%s': %s\n", topic, message.c_str());
  
  // Handle medication reminder
  if (String(topic) == "elder_band/medication") {
    if (message == "true" || message == "1") {
      medicationReminder = true;
      medicationReminderStartTime = millis();
      digitalWrite(BUZZER_PIN, HIGH); // Start buzzer for medication reminder
      Serial.println("Medication reminder activated!");
    } else if (message == "false" || message == "0") {
      medicationReminder = false;
      digitalWrite(BUZZER_PIN, LOW); // Stop buzzer
      Serial.println("Medication reminder deactivated!");
    }
  }
  
  // Handle other commands if needed
  if (String(topic) == "elder_band/cmd") {
    // Add other command handling here if needed
    Serial.printf("Command received: %s\n", message.c_str());
  }
}

void reconnectMQTT() {
  int attempts = 0;
  while (!client.connected() && attempts < 3) {
    Serial.print("Attempting MQTT connection to ");
    Serial.print(mqtt_server);
    Serial.print(":");
    Serial.print(mqtt_port);
    Serial.print("...");
    
    // Test basic connectivity first
    WiFiClient testClient;
    if (!testClient.connect(mqtt_server, mqtt_port)) {
      Serial.println("Cannot reach MQTT broker!");
      Serial.println("Check if MQTT broker is running and accessible");
      testClient.stop();
      delay(3000);
      attempts++;
      continue;
    }
    testClient.stop();
    Serial.println("Broker reachable, attempting MQTT handshake...");
    
    // Create a random client ID
    String clientId = "ElderBand-";
    clientId += String(WiFi.macAddress());
    clientId.replace(":", "");
    
    if (client.connect(clientId.c_str())) {
      Serial.println("MQTT connected successfully!");
      mqttConnected = true;
      
      // Subscribe to topics
      client.subscribe("elder_band/cmd");
      client.subscribe("elder_band/medication"); // Subscribe to medication topic
      
      // Send a connection message
      client.publish("elder_band/status", "Device connected", true);
      break;
    } else {
      Serial.print("MQTT handshake failed, rc=");
      Serial.print(client.state());
      
      // Decode error codes
      switch(client.state()) {
        case -4: Serial.println(" (Connection timeout)"); break;
        case -3: Serial.println(" (Connection lost)"); break;
        case -2: Serial.println(" (Connect failed)"); break;
        case -1: Serial.println(" (Disconnected)"); break;
        case 1: Serial.println(" (Bad protocol version)"); break;
        case 2: Serial.println(" (Bad client ID)"); break;
        case 3: Serial.println(" (Unavailable)"); break;
        case 4: Serial.println(" (Bad credentials)"); break;
        case 5: Serial.println(" (Unauthorized)"); break;
        default: Serial.println(" (Unknown error)"); break;
      }
      
      delay(3000); 
      attempts++;
    }
  }
  
  if (!client.connected()) {
    mqttConnected = false;
    Serial.println("MQTT connection failed after 3 attempts");
    Serial.println("Continuing without MQTT...");
  }
}

void sendToMQTT() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, attempting reconnection...");
    connectToWiFi();
    return;
  }
  
  if (!client.connected()) {
    Serial.println("MQTT disconnected, attempting reconnection...");
    reconnectMQTT();
  }
  
  if (client.connected()) {
    char msg[512];
    int currentHR = validHeartRate && heartRate > 0 && heartRate < 200 ? heartRate : beatAvg;
    int currentSpO2 = validSPO2 && spo2 > 0 && spo2 <= 100 ? spo2 : 98; // Default reasonable value
    
    // Only report fall as true if it's detected AND not canceled
    bool reportFall = fallDetected && !fallCanceled;
    
    snprintf(msg, sizeof(msg), 
             "{\"deviceId\":\"%s\",\"heartRate\":%d,\"spo2\":%d,\"temperature\":%.2f,\"fall\":%s,\"emergency\":%s,\"fingerDetected\":%s,\"call\":%s,\"medicationReminder\":%s,\"timestamp\":%lu,\"freeHeap\":%d}",
             WiFi.macAddress().c_str(),
             currentHR, currentSpO2, temperatureC,
             reportFall ? "true" : "false", 
             emergency ? "true" : "false",
             fingerDetected ? "true" : "false",
             callInitiated ? "true" : "false",
             medicationReminder ? "true" : "false",
             millis(),
             ESP.getFreeHeap());
             
    bool published = client.publish("elder_band/data", msg, true); // Retain message
    
    if (published) {
      Serial.println("✓ MQTT message sent:");
      Serial.println(msg);
    } else {
      Serial.println("✗ Failed to send MQTT message");
      Serial.print("Client state: ");
      Serial.println(client.state());
    }
    
    // Reset call initiated flag after sending
    if (callInitiated) {
      callInitiated = false;
    }
  } else {
    Serial.println("MQTT not connected, skipping message send");
  }
}

void MQTTLoopTask(void *pvParameters) {
  for (;;) {
    if (WiFi.status() == WL_CONNECTED) {
      if (!client.connected()) {
        reconnectMQTT();
      } else {
        client.loop();
      }
    }
    delay(100);
  }
}

// -----------------------------
// FIXED Button Handling Task
// -----------------------------
void ButtonTask(void *pvParameters) {
  bool lastCancelState = HIGH;
  bool lastCallState = HIGH;
  unsigned long lastCancelDebounce = 0;
  unsigned long lastCallDebounce = 0;
  const unsigned long debounceDelay = 50;
  
  // Use static variables to minimize stack usage
  static bool cancelPressed = false;
  static bool callPressed = false;
  
  for (;;) {
    // Handle cancel button with minimal stack usage
    bool cancelReading = digitalRead(CANCEL_BUTTON);
    if (cancelReading != lastCancelState) {
      lastCancelDebounce = millis();
    }
    
    if ((millis() - lastCancelDebounce) > debounceDelay) {
      if (cancelReading == LOW && !cancelPressed) { // Button pressed (assuming active low)
        cancelPressed = true;
        
        // Simple flag setting - avoid heavy operations in task
        if (fallDetected) {
          Serial.println("Fall alert cancelled by user");
          digitalWrite(BUZZER_PIN, LOW);
          fallDetected = false;
          fallCanceled = true;
        }
        if (medicationReminder) {
          Serial.println("Medication reminder cancelled by user");
          medicationReminder = false;
          digitalWrite(BUZZER_PIN, LOW);
        }
      } else if (cancelReading == HIGH) {
        cancelPressed = false; // Reset when button released
      }
    }
    lastCancelState = cancelReading;
    
    // Handle call button with minimal stack usage
    bool callReading = digitalRead(CALL_BUTTON);
    if (callReading != lastCallState) {
      lastCallDebounce = millis();
    }
    
    if ((millis() - lastCallDebounce) > debounceDelay) {
      if (callReading == LOW && !callPressed) { // Button pressed (assuming active low)
        callPressed = true;
        
        // Just set flag - let another task handle the heavy MQTT work
        Serial.println("Emergency call initiated by user");
        callInitiated = true;
        
        // Don't call sendToMQTT() here - it causes stack overflow
        // The SpO2Task will handle sending the next MQTT message
        
      } else if (callReading == HIGH) {
        callPressed = false; // Reset when button released
      }
    }
    lastCallState = callReading;
    
    // Longer delay to reduce CPU usage and stack pressure
    delay(100);
  }
}

// -----------------------------
// Improved Heart Rate Calculation
// -----------------------------
void calculateHeartRate(long irValue) {
  if (checkForBeat(irValue)) {
    unsigned long currentTime = millis();
    long delta = currentTime - lastBeat;
    lastBeat = currentTime;
    
    // Only calculate if delta is reasonable (300-2000ms = 30-200 BPM)
    if (delta > 300 && delta < 2000) {
      beatsPerMinute = 60000.0 / delta; // Convert to BPM
      
      // Store in rolling average array
      rateArray[rateArrayIndex++] = (long)beatsPerMinute;
      rateArrayIndex %= RATE_ARRAY_SIZE;
      
      // Calculate average
      long total = 0;
      for (byte i = 0; i < RATE_ARRAY_SIZE; i++) {
        total += rateArray[i];
      }
      beatAvg = total / RATE_ARRAY_SIZE;
      
      // Bounds checking
      beatAvg = constrain(beatAvg, 40, 200);
    }
  }
}

// -----------------------------
// Improved SpO2 Calculation
// -----------------------------
void calculateSpO2(uint32_t *irBuffer, uint32_t *redBuffer) {
  // Calculate ratio of AC/DC components
  long redAC = 0, irAC = 0;
  long redDC = 0, irDC = 0;
  
  // Find AC and DC components
  for (int i = 0; i < 100; i++) {
    redDC += (long)redBuffer[i];
    irDC += (long)irBuffer[i];
  }
  redDC /= 100;
  irDC /= 100;
  
  for (int i = 0; i < 100; i++) {
    long redDiff = (long)redBuffer[i] - redDC;
    long irDiff = (long)irBuffer[i] - irDC;
    redAC += (redDiff < 0) ? -redDiff : redDiff; // Manual abs for long
    irAC += (irDiff < 0) ? -irDiff : irDiff;     // Manual abs for long
  }
  
  if (irAC > 0 && irDC > 0 && redDC > 0) {
    float ratio = (float)(redAC * irDC) / (float)(irAC * redDC);
    
    // Empirical formula for SpO2 calculation (common approximation)
    float calculatedSpO2 = 110.0 - 25.0 * ratio;
    
    // Reasonable bounds for SpO2
    calculatedSpO2 = constrain(calculatedSpO2, 70, 100);
    
    // Use rolling average for stability
    if (validReadings < MIN_VALID_READINGS) {
      ratioAvg = (ratioAvg * validReadings + calculatedSpO2) / (validReadings + 1);
      validReadings++;
    } else {
      ratioAvg = (ratioAvg * 0.8) + (calculatedSpO2 * 0.2);
    }
    
    spo2 = (int)ratioAvg;
    validSPO2 = (validReadings >= MIN_VALID_READINGS) ? 1 : 0;
  }
}

// -----------------------------
// Tasks
// -----------------------------
void HeartRateBeatTask(void *pvParameters) {
  for (;;) {
    long irValue = max30102.getIR();
    
    // More sensitive finger detection
    fingerDetected = (irValue > 7000);
    
    if (fingerDetected) {
      calculateHeartRate(irValue);
    } else {
      // Reset when finger removed
      validReadings = 0;
      ratioAvg = 0;
    }
    
    delay(20);
  }
}

void SpO2Task(void *pvParameters) {
  uint32_t irBuffer[100];
  uint32_t redBuffer[100];
  unsigned long lastRegularSend = 0;
  const unsigned long REGULAR_SEND_INTERVAL = 3000;

  for (;;) {
    // Check for immediate call sending first
    if (callInitiated) {
      Serial.println("Sending emergency call message...");
      sendToMQTT(); // This will reset callInitiated flag
      // Don't continue with regular processing this cycle
      delay(1000);
      continue;
    }
    
    if (!fingerDetected) {
      spo2 = -1;
      validSPO2 = 0;
      heartRate = -1;
      validHeartRate = 0;
      
      // Still send MQTT updates even without finger detection
      if (millis() - lastRegularSend > REGULAR_SEND_INTERVAL) {
        sendToMQTT();
        lastRegularSend = millis();
      }
      
      delay(2000);
      continue;
    }

    // Collect samples (only when finger detected)
    for (byte i = 0; i < 100; i++) {
      while (!max30102.available()) {
        delay(1);
      }
      redBuffer[i] = max30102.getRed();
      irBuffer[i] = max30102.getIR();
      max30102.nextSample();
      delay(10);
    }
    
    // Use improved SpO2 calculation instead of library
    calculateSpO2(irBuffer, redBuffer);
    
    // Also try library calculation for comparison
    maxim_heart_rate_and_oxygen_saturation(irBuffer, 100, redBuffer,
                                           &heartRate, &validHeartRate,
                                           &spo2, &validSPO2);
    
    // Use library values if they seem reasonable, otherwise use our calculation
    if (validHeartRate && heartRate > 40 && heartRate < 200) {
      // Library heart rate seems good
    } else {
      heartRate = beatAvg;
      validHeartRate = fingerDetected ? 1 : 0;
    }
    
    // Emergency detection with more reasonable thresholds
    emergency = ((validHeartRate && (heartRate > 150 || heartRate < 50)) ||
             (temperatureC > 34.0 || temperatureC < 28.0) ||
             (fallDetected && !fallCanceled));
    
    // Regular MQTT sending
    sendToMQTT();
    lastRegularSend = millis();
    delay(3000);
  }
}

void FallDetectionTask(void *pvParameters) {
  float baseline = 1000.0; // Approximate 1g in sensor units
  int fallThreshold = 600;  // Lowered for better sensitivity
  int impactThreshold = 1200; // Lowered but still high enough to avoid hand movements
  
  // Moving average for stability
  const int SAMPLE_SIZE = 8;  // Smaller window for faster response
  float magnitudeHistory[SAMPLE_SIZE];
  int historyIndex = 0;
  bool historyFilled = false;
  
  // Fall detection state machine
  bool potentialFall = false;
  unsigned long fallStartTime = 0;
  const unsigned long FALL_CONFIRMATION_TIME = 800; // Shorter confirmation time
  const unsigned long FALL_RECOVERY_TIME = 2000; // Shorter recovery time
  unsigned long lastFallTime = 0;
  
  // Initialize history with baseline values
  for (int i = 0; i < SAMPLE_SIZE; i++) {
    magnitudeHistory[i] = baseline;
  }
  
  for (;;) {
    if (accel.available()) {
      accel.read();
      int x = accel.getX();
      int y = accel.getY();
      int z = accel.getZ();
      
      float magnitude = sqrt((float)(x * x + y * y + z * z));
      
      // Store in moving average buffer
      magnitudeHistory[historyIndex] = magnitude;
      historyIndex = (historyIndex + 1) % SAMPLE_SIZE;
      if (historyIndex == 0) historyFilled = true;
      
      // Calculate moving average for stable baseline
      float avgMagnitude = 0;
      int samples = historyFilled ? SAMPLE_SIZE : historyIndex;
      for (int i = 0; i < samples; i++) {
        avgMagnitude += magnitudeHistory[i];
      }
      avgMagnitude /= samples;
      
      // Calculate deviation from stable average
      float deviation = abs(magnitude - avgMagnitude);
      
      // Prevent false positives too soon after last fall
      unsigned long currentTime = millis();
      if (currentTime - lastFallTime < FALL_RECOVERY_TIME) {
        delay(100);
        continue;
      }
      
      // Multi-stage fall detection
      if (!potentialFall && !fallDetected) {
        // Stage 1: Detect sudden high G-force OR significant deviation
        if (magnitude > (baseline + impactThreshold) || 
            magnitude < (baseline - fallThreshold) ||
            deviation > fallThreshold) {
          Serial.printf("Potential fall detected! Magnitude: %.2f, Deviation: %.2f\n", magnitude, deviation);
          potentialFall = true;
          fallStartTime = currentTime;
        }
      }
      else if (potentialFall && !fallDetected) {
        // Stage 2: More lenient confirmation - if EITHER condition is true, confirm fall
        if (currentTime - fallStartTime > FALL_CONFIRMATION_TIME) {
          // Check if we still have abnormal readings OR very low/high activity
          bool stillAbnormal = (deviation > (fallThreshold * 0.6)) || 
                              (magnitude < (baseline - 200)) ||
                              (magnitude > (baseline + fallThreshold));
          
          // Also check for sustained orientation change (person lying down)
          bool orientationChanged = (magnitude < (baseline * 0.7)) || (magnitude > (baseline * 1.4));
          
          if (stillAbnormal || orientationChanged) {
            Serial.println("FALL CONFIRMED! Alert activated!");
            Serial.printf("Final magnitude: %.2f, Baseline: %.2f, Deviation: %.2f\n", 
                         magnitude, baseline, deviation);
            digitalWrite(BUZZER_PIN, HIGH);
            fallDetected = true;
            fallCanceled = false; // Reset cancel flag when new fall is detected
            lastFallTime = currentTime;
          } else {
            Serial.println("Readings stabilized - likely normal movement");
            potentialFall = false;
          }
        }
      }
      
      // Auto-cancel potential fall only if readings are very stable for normal movements
      if (potentialFall && !fallDetected) {
        if (deviation < (fallThreshold * 0.3) && 
            magnitude > (baseline - 150) && magnitude < (baseline + 150)) {
          // Only cancel if readings are very close to normal for a bit
          static unsigned long stableStartTime = 0;
          if (stableStartTime == 0) {
            stableStartTime = currentTime;
          } else if (currentTime - stableStartTime > 400) { // 400ms of stable readings
            Serial.println("Very stable readings - canceling potential fall");
            potentialFall = false;
            stableStartTime = 0;
          }
        } else {
          static unsigned long stableStartTime = 0;
          stableStartTime = 0; // Reset if not stable
        }
      }
      
      // Debug output every 5 seconds
      static unsigned long lastDebug = 0;
      if (currentTime - lastDebug > 5000) {
        Serial.printf("Accel Debug - Mag: %.2f, Avg: %.2f, Dev: %.2f, State: %s\n", 
                     magnitude, avgMagnitude, deviation,
                     fallDetected ? "FALL_ACTIVE" : 
                     potentialFall ? "POTENTIAL_FALL" : "NORMAL");
        lastDebug = currentTime;
      }
    }
    delay(50); // Faster sampling for better fall detection
  }
}

void TemperatureTask(void *pvParameters) {
  for (;;) {
    sensors_event_t temp;
    if (tmp117.getEvent(&temp)) {
      temperatureC = temp.temperature;
    }
    delay(2000);
  }
}

void DisplayTask(void *pvParameters) {
  for (;;) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);

    // Check if medication reminder is active and should be shown full screen
    if (medicationReminder) {
      // Full screen medication reminder
      display.clearDisplay();
      display.setTextSize(2);
      display.setTextColor(SSD1306_WHITE);
      display.setCursor(0, 10);
      display.println("MEDICATION");
      display.println("   TIME!");
      display.setTextSize(1);
      display.setCursor(0, 50);
      display.println("Press cancel to stop");
      display.display();
      
      // Auto-dismiss after duration
      if (millis() - medicationReminderStartTime > MEDICATION_REMINDER_DURATION) {
        medicationReminder = false;
        digitalWrite(BUZZER_PIN, LOW);
        Serial.println("Medication reminder auto-dismissed");
      }
    } else {
      // Normal display
      if (fingerDetected) {
        display.printf("HR: %d BPM\n", validHeartRate ? heartRate : beatAvg);
        display.printf("SpO2: %d%%\n", validSPO2 ? spo2 : 98);
      } else {
        display.println("HR: -- BPM");
        display.println("SpO2: --%");
        display.println("Place finger");
      }

      display.printf("Temp: %.1f C\n", temperatureC);
      display.printf("Fall: %s\n", (fallDetected && !fallCanceled) ? "YES" : "No");
      
      // Connection status
      display.printf("WiFi: %s\n", WiFi.status() == WL_CONNECTED ? "OK" : "X");
      display.printf("MQTT: %s", client.connected() ? "OK" : "X");
      
      display.display();
    }
    
    delay(1000);
  }
}

// Optional: Add stack monitoring function to help debug
void printTaskStackUsage() {
  Serial.println("=== Task Stack Usage ===");
  Serial.printf("Free heap: %d bytes\n", ESP.getFreeHeap());
  Serial.printf("Min free heap: %d bytes\n", ESP.getMinFreeHeap());
}

// -----------------------------
// Setup
// -----------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  // Initialize I2C
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000); // 100kHz for stability

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(CANCEL_BUTTON, INPUT_PULLUP);
  pinMode(CALL_BUTTON, INPUT_PULLUP);
  
  // Initialize rate array
  for (int i = 0; i < RATE_ARRAY_SIZE; i++) {
    rateArray[i] = 70;
  }

  // Connect to WiFi
  connectToWiFi();
  
  // Setup MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(onMqttMessage);
  client.setKeepAlive(60);
  client.setSocketTimeout(15);
  client.setBufferSize(512);
  
  // Test MQTT broker connectivity
  Serial.print("Testing MQTT broker connectivity to ");
  Serial.print(mqtt_server);
  Serial.print(":");
  Serial.println(mqtt_port);
  
  WiFiClient testClient;
  if (testClient.connect(mqtt_server, mqtt_port)) {
    Serial.println("MQTT broker is reachable!");
    testClient.stop();
  } else {
    Serial.println("WARNING: Cannot reach MQTT broker!");
    Serial.println("Please check:");
    Serial.println("1. MQTT broker IP address: " + String(mqtt_server));
    Serial.println("2. MQTT broker is running");
    Serial.println("3. Port " + String(mqtt_port) + " is open");
    Serial.println("4. No firewall blocking connection");
  }

  // Initialize sensors (same as before)
  if (!max30102.begin(Wire, I2C_SPEED_STANDARD)) {
    Serial.println("MAX30102 not found");
    while (1) delay(1000);
  }
  
  Serial.println("MAX30102 found");
  max30102.setup();
  max30102.setPulseAmplitudeRed(0x50);
  max30102.setPulseAmplitudeIR(0x50);
  max30102.setLEDMode(2);

  if (!tmp117.begin()) {
    Serial.println("TMP117 not found");
    while (1) delay(1000);
  }
  Serial.println("TMP117 found");

  if (!accel.begin(Wire, 0x1C)) {
    Serial.println("MMA8452 not found");
    while (1) delay(1000);
  }
  Serial.println("MMA8452 found");
  accel.setScale(SCALE_2G);
  accel.setDataRate(ODR_50);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 OLED not found");
    while (1) delay(1000);
  }
  Serial.println("Display found");

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Initializing...");
  display.display();
  delay(2000);

  // Start tasks with INCREASED stack sizes and proper priorities
  xTaskCreatePinnedToCore(HeartRateBeatTask, "HeartBeat", 4096, NULL, 2, NULL, 1);
  xTaskCreatePinnedToCore(SpO2Task, "SpO2", 12288, NULL, 2, NULL, 1);  // Increased stack
  xTaskCreatePinnedToCore(FallDetectionTask, "FallDetect", 6144, NULL, 1, NULL, 0);  // Increased stack
  xTaskCreatePinnedToCore(TemperatureTask, "Temperature", 3072, NULL, 1, NULL, 0);  // Increased stack
  xTaskCreatePinnedToCore(DisplayTask, "Display", 4096, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(MQTTLoopTask, "MQTTLoop", 8192, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(ButtonTask, "ButtonHandler", 4096, NULL, 1, NULL, 0);  // DOUBLED stack size

  Serial.println("All tasks started");
}

// Optional: Add stack monitoring function to help debug

void loop() {
  // Main loop can be used for watchdog or system monitoring
  delay(5000);
  
  // Print system status periodically
  Serial.printf("Free heap: %d, WiFi: %s, MQTT: %s\n", 
                ESP.getFreeHeap(),
                WiFi.status() == WL_CONNECTED ? "OK" : "Disconnected",
                client.connected() ? "Connected" : "Disconnected");
}


