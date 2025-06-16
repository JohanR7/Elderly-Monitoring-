# Elderly Monitoring System - Updated Architecture

## Overview
The system has been updated to properly integrate Arduino GSM, ESP32, MQTT, and Django backend components with improved data flow and emergency handling.

## Updated Components

### 1. Arduino GSM Module (gsm.ino)
**Status: ✅ Already Working**
- Handles CALL and SOS commands via serial
- CALL format: `CALL:<phone_number>`
- SOS format: `SOS:<phone_number>` (sends SMS + makes call)
- Supports multiple phone numbers for SOS (comma-separated)

### 2. ESP32 Main Controller (main.ino)
**Status: ✅ Updated & Working**
- **New Features Added:**
  - Medication reminder system with MQTT integration
  - Call button functionality (GPIO 4)
  - Enhanced MQTT message format with all sensor data
  - Improved fall detection with user cancellation
  
- **MQTT Data Format:**
```json
{
  "deviceId": "AA:BB:CC:DD:EE:FF",
  "heartRate": 72,
  "spo2": 98,
  "temperature": 36.5,
  "fall": false,
  "emergency": false,
  "fingerDetected": true,
  "call": false,
  "medicationReminder": false,
  "timestamp": 1750058312,
  "freeHeap": 45000
}
```

### 3. MQTT Client (main.py)
**Status: ✅ Completely Rewritten**
- **New Features:**
  - Device-specific patient data fetching
  - Proper emergency handling (3 consecutive alerts trigger response)
  - Call button handling (immediate response)
  - Medication reminder scheduling (9 AM & 9 PM)
  - Improved serial communication with Arduino GSM
  - Blood pressure prediction using ML model
  - Automatic backend data posting

- **Emergency Response Logic:**
  - Emergency signals: 3+ consecutive → SOS (SMS + Call)
  - Call button: 1 press → Regular call
  - Fall detection: Included in emergency logic

- **Serial Commands Sent:**
  - `CALL:<number>` - Regular call
  - `SOS:<number>` - Emergency (SMS + call)

### 4. Django Backend (views.py, urls.py, models.py)
**Status: ✅ Enhanced**
- **New API Endpoints:**
  - `GET /api/device/{device_id}/patient/` - Get patient by device ID
  - `GET /api/device/{device_id}/status/` - Check device status
  - `POST /api/emergency/log/` - Log emergency events
  
- **Enhanced Features:**
  - Device-specific data handling
  - Automatic device creation on first data post
  - Device activity tracking (last 2 minutes)
  - Improved health data serialization

## Data Flow

### Normal Operation
1. **ESP32** → Collects sensor data (HR, SpO2, temp, fall, etc.)
2. **ESP32** → Publishes to MQTT topic `elder_band/data`
3. **MQTT Client** → Receives data, fetches patient info from backend
4. **MQTT Client** → Predicts blood pressure using ML model
5. **MQTT Client** → Posts complete health data to Django backend
6. **Backend** → Stores data and updates device activity

### Emergency Scenarios

#### Automatic Emergency (Fall/Vitals)
1. **ESP32** → Detects emergency condition → `"emergency": true`
2. **MQTT Client** → Counts consecutive emergency signals
3. **MQTT Client** → After 3 signals → Sends `SOS:<emergency_contact>`
4. **Arduino GSM** → Sends emergency SMS + makes call
5. **Backend** → Logs emergency event

#### Manual Call Button
1. **ESP32** → Call button pressed → `"call": true`
2. **MQTT Client** → Immediately sends `CALL:<emergency_contact>`
3. **Arduino GSM** → Makes call
4. **Backend** → Logs call event

#### Medication Reminders
1. **MQTT Client** → Scheduled at 9 AM & 9 PM
2. **MQTT Client** → Publishes to `elder_band/medication` topic
3. **ESP32** → Receives medication reminder → Activates buzzer/display
4. **ESP32** → User can cancel with cancel button

## Installation & Setup

### Dependencies
```bash
# MQTT Client dependencies
cd MQTT
pip install -r requirements.txt

# Backend (Django already set up)
cd backend
python manage.py runserver 8000

# MQTT Broker
sudo pacman -S mosquitto  # or apt-get install mosquitto
mosquitto -v  # Start broker
```

### Running the System
1. **Start Django Backend:**
   ```bash
   cd backend && python manage.py runserver 8000
   ```

2. **Start MQTT Broker:**
   ```bash
   mosquitto -v
   ```

3. **Start MQTT Client:**
   ```bash
   cd MQTT && source venv/bin/activate && python main.py
   ```

4. **Flash ESP32 with main.ino**

5. **Connect Arduino GSM module to ESP32 via serial**

## Testing

### Test Patient Registration
```bash
curl -X POST "http://127.0.0.1:8000/api/auth/register/" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testpatient",
    "password": "testpass123", 
    "email": "test@example.com",
    "device_id": "AA:BB:CC:DD:EE:FF",
    "patient_name": "Test Patient",
    "patient_age": 65,
    "emergency_contact_phone": "+919778235268"
  }'
```

### Test MQTT Data
```bash
mosquitto_pub -h localhost -t "elder_band/data" -m '{
  "deviceId":"AA:BB:CC:DD:EE:FF",
  "heartRate":72,
  "emergency":true,
  "call":false
}'
```

### Test Medication Reminder
```bash
mosquitto_pub -h localhost -t "elder_band/medication" -m "true"
```

## Configuration

### ESP32 WiFi/MQTT Settings (main.ino)
```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD"; 
const char* mqtt_server = "192.168.1.100";  // MQTT broker IP
```

### MQTT Client Settings (main.py)
```python
MQTT_BROKER = 'localhost'  # Change to ESP32's target
BACKEND_URL = 'http://127.0.0.1:8000/api'
SERIAL_PORT = '/dev/ttyACM0'  # Arduino GSM serial port
```

## Hardware Connections

### ESP32 to Sensors
- MAX30102: I2C (SDA=21, SCL=20)
- TMP117: I2C (SDA=21, SCL=20)  
- MMA8452Q: I2C (SDA=21, SCL=20)
- OLED: I2C (SDA=21, SCL=20)
- Buzzer: GPIO 10
- Cancel Button: GPIO 3 (with pull-up)
- Call Button: GPIO 4 (with pull-up)

### ESP32 to Arduino GSM
- Serial communication (default Serial1 or software serial)
- Commands: `CALL:<number>` or `SOS:<number>`

## Status
- ✅ Backend API working
- ✅ MQTT broker running
- ✅ MQTT client processing messages  
- ✅ Emergency detection working
- ✅ Call button working
- ✅ Patient data fetching working
- ✅ Health data posting working
- ✅ Serial command generation working
- ⚠️ Serial connection to Arduino GSM (requires physical hardware)

## Next Steps
1. Connect physical Arduino GSM module
2. Test complete hardware integration
3. Deploy to production environment
4. Add web dashboard for monitoring
5. Implement notification systems for caregivers
