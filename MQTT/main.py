import paho.mqtt.client as mqtt
import json
import joblib
import serial
import time
import requests
import random
from collections import deque
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime

# MQTT config
MQTT_BROKER = 'localhost'
MQTT_PORT = 1883
MQTT_TOPIC = 'elder_band/data'
MEDICATION_TOPIC = 'elder_band/medication'

# Serial config
SERIAL_PORT = '/dev/ttyACM0'
BAUD_RATE = 9600

# Backend config
BACKEND_URL = 'http://127.0.0.1:8000/api'

# Load model
model = joblib.load('sbp_rf_model_realdata.joblib')

# Patient info - will be fetched from backend
patient_info = {
    'age': 30,
    'sex': 1,
    'device_id': None,
    'emergency_contact_phone': None,
    'doctor_phone': None,
}

# Buffers and state
buffer = deque(maxlen=5)
emergency_count = 0
call_count = 0
current_device_id = None

# Medication schedule
medications = [
    "Amlodipine 5mg", "Metformin 500mg", "Atorvastatin 10mg",
    "Losartan 50mg", "Enalapril 10mg", "Paracetamol 500mg"
]

# Initialize serial
try:
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
    time.sleep(2)
    print("Serial connection established")
except Exception as e:
    print(f"Failed to establish serial connection: {e}")
    ser = None

# Fetch patient data from Django backend using device ID
def fetch_patient_data(device_id):
    global patient_info
    try:
        # First, try to get patient data by device ID
        response = requests.get(f"{BACKEND_URL}/health-data/", 
                              params={'device_id': device_id})
        if response.status_code == 200:
            print(f"Successfully connected to backend for device {device_id}")
        
        # Try to get patient contact info (legacy endpoint for fallback)
        try:
            response = requests.get(f"{BACKEND_URL}/patient-contact/")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and data:
                    contact_data = data[0]
                    patient_info.update({
                        'age': contact_data.get('patient_age', patient_info['age']),
                        'sex': 1 if contact_data.get('patient_sex', '').lower() == 'male' else 0,
                        'device_id': device_id,
                        'emergency_contact_phone': contact_data.get('emergency_contact_phone'),
                        'doctor_phone': contact_data.get('doctor_phone'),
                    })
                    print(f"Updated patient info: {patient_info}")
                    return True
        except Exception as e:
            print(f"Fallback patient contact fetch failed: {e}")
        
        # If no specific patient data found, use defaults but still track device
        patient_info['device_id'] = device_id
        print(f"Using default patient info for device {device_id}")
        return True
        
    except Exception as e:
        print(f"Failed to fetch patient data: {e}")
        return False

# Post health data to backend with device ID
def post_to_backend(device_id, hr, spo2, temp, fall, bp, emergency=False, call_initiated=False):
    try:
        payload = {
            "device_id": device_id,
            "heart_rate": int(hr) if hr and hr > 0 else None,
            "spo2": int(spo2) if spo2 and spo2 > 0 else None,
            "body_temp": round(temp, 2) if temp else None,
            "fall_detected": bool(fall),
            "blood_pressure": str(round(bp, 2)) if bp else None
        }
        
        response = requests.post(f"{BACKEND_URL}/health-data/", json=payload)
        response.raise_for_status()
        print(f"Posted to backend: {payload}")
        
        # Log emergency or call events
        if emergency:
            print(f"EMERGENCY EVENT logged for device {device_id}")
        if call_initiated:
            print(f"CALL EVENT logged for device {device_id}")
            
        return True
    except Exception as e:
        print(f"Failed to post to backend: {e}")
        return False

# Send emergency call command via serial
def send_emergency_call():
    global ser, patient_info
    if not ser:
        print("Serial connection not available")
        return False
        
    emergency_phone = patient_info.get('emergency_contact_phone')
    doctor_phone = patient_info.get('doctor_phone')
    
    if emergency_phone:
        # Send SOS to emergency contact (includes SMS + call)
        cmd = f"SOS:{emergency_phone}\n"
        try:
            ser.write(cmd.encode())
            print(f"Sent SOS command: {cmd.strip()}")
            return True
        except Exception as e:
            print(f"Failed to send SOS command: {e}")
    
    elif doctor_phone:
        # Fallback to doctor call
        cmd = f"CALL:{doctor_phone}\n"
        try:
            ser.write(cmd.encode())
            print(f"Sent CALL command to doctor: {cmd.strip()}")  
            return True
        except Exception as e:
            print(f"Failed to send CALL command: {e}")
    
    else:
        print("No emergency contact or doctor phone available")
    
    return False

# Send regular call command via serial
def send_call():
    global ser, patient_info
    if not ser:
        print("Serial connection not available")
        return False
        
    # For regular calls, try emergency contact first, then doctor
    phone_to_call = (patient_info.get('emergency_contact_phone') or 
                    patient_info.get('doctor_phone'))
    
    if phone_to_call:
        cmd = f"CALL:{phone_to_call}\n"
        try:
            ser.write(cmd.encode())
            print(f"Sent CALL command: {cmd.strip()}")
            return True
        except Exception as e:
            print(f"Failed to send CALL command: {e}")
    else:
        print("No phone number available for calling")
    
    return False

# Process health data and predict blood pressure
def process_and_predict(messages):
    if not messages:
        return
        
    # Calculate averages from the message buffer
    avg_hr = sum(m.get('heartRate', 70) for m in messages) / len(messages)
    avg_spo2 = sum(m.get('spo2', 98) for m in messages) / len(messages)
    avg_temp = sum(m.get('temperature', 36.5) for m in messages) / len(messages)
    fall_any = any(m.get('fall', False) for m in messages)
    emergency_any = any(m.get('emergency', False) for m in messages)
    
    # Get device ID from messages
    device_id = current_device_id or messages[0].get('deviceId', 'unknown')
    
    # Predict blood pressure using the model
    try:
        X = [[patient_info['age'], avg_hr, avg_spo2, avg_temp]]
        predicted_sbp = model.predict(X)[0]
        print(f"Predicted SBP: {predicted_sbp:.2f}")
    except Exception as e:
        print(f"Blood pressure prediction failed: {e}")
        predicted_sbp = 120  # Default value
    
    # Post to backend
    post_to_backend(device_id, avg_hr, avg_spo2, avg_temp, fall_any, 
                   predicted_sbp, emergency_any, False)

# Handle incoming MQTT messages from ESP32
def on_message(client, userdata, msg):
    global buffer, emergency_count, call_count, current_device_id, patient_info

    try:
        data = json.loads(msg.payload.decode())
        print(f"Received MQTT data: {data}")
        
        # Extract device ID and update global state
        device_id = data.get('deviceId', 'unknown')
        if current_device_id != device_id:
            current_device_id = device_id
            # Fetch patient data for this device
            fetch_patient_data(device_id)
        
        buffer.append(data)

        # Process every 5 messages for blood pressure prediction
        if len(buffer) == 5:
            process_and_predict(list(buffer))
            buffer.clear()

        # Handle emergency situations (fall, extreme vitals)
        if data.get('emergency', False):
            emergency_count += 1
            print(f"Emergency detected! Count: {emergency_count}")
            
            # Send emergency call after 3 consecutive emergency signals
            if emergency_count >= 3:
                print("EMERGENCY THRESHOLD REACHED - Initiating emergency call")
                if send_emergency_call():
                    # Post emergency event to backend
                    post_to_backend(device_id, 
                                  data.get('heartRate', 0),
                                  data.get('spo2', 0), 
                                  data.get('temperature', 0),
                                  data.get('fall', False),
                                  None, # BP will be predicted
                                  True, # emergency=True
                                  False)
                emergency_count = 0  # Reset after handling
        else:
            emergency_count = max(0, emergency_count - 1)  # Gradually decrease if no emergency

        # Handle manual call button press
        if data.get('call', False):
            call_count += 1
            print(f"Call button pressed! Count: {call_count}")
            
            # Send call immediately on button press
            if call_count >= 1:
                print("CALL BUTTON PRESSED - Initiating call")
                if send_call():
                    # Post call event to backend
                    post_to_backend(device_id,
                                  data.get('heartRate', 0),
                                  data.get('spo2', 0),
                                  data.get('temperature', 0), 
                                  data.get('fall', False),
                                  None, # BP will be predicted
                                  False,
                                  True) # call_initiated=True
                call_count = 0  # Reset after handling

        # Handle fall detection specifically
        if data.get('fall', False):
            print("FALL DETECTED - Checking for emergency response")
            # Falls are also handled by emergency logic above
            
        # Handle medication reminder status
        if data.get('medicationReminder', False):
            print("Device reports active medication reminder")

    except json.JSONDecodeError as e:
        print(f"Invalid JSON received: {e}")
    except Exception as e:
        print(f"Error processing MQTT message: {e}")

# Send medication reminder to ESP32
def send_medication_reminder(client, medication_time):
    try:
        # Send simple boolean trigger - ESP32 handles the buzzing/display
        client.publish(MEDICATION_TOPIC, "true")
        print(f"Sent medication reminder for {medication_time}")
        
        # Also send medication info (optional, for future use)
        medication_info = {
            "type": "medication",
            "medicine": random.choice(medications),
            "time": medication_time,
            "timestamp": datetime.now().isoformat()
        }
        client.publish("elder_band/cmd", json.dumps(medication_info))
        print(f"Sent medication info: {medication_info}")
        
    except Exception as e:
        print(f"Failed to send medication reminder: {e}")

# Setup medication reminder scheduler
def setup_medication_schedule(client):
    scheduler = BackgroundScheduler()
    
    # Morning medication reminder (9:00 AM)
    scheduler.add_job(
        lambda: send_medication_reminder(client, "morning"), 
        'cron', 
        hour=9, 
        minute=0
    )
    
    # Evening medication reminder (9:00 PM)
    scheduler.add_job(
        lambda: send_medication_reminder(client, "evening"), 
        'cron', 
        hour=21, 
        minute=0
    )
    
    # Optional: Add more frequent reminders for testing
    # scheduler.add_job(
    #     lambda: send_medication_reminder(client, "test"), 
    #     'interval', 
    #     minutes=5
    # )
    
    scheduler.start()
    print("Medication schedule setup complete")

# MQTT connection handlers
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected to MQTT broker successfully")
        client.subscribe(MQTT_TOPIC)
        print(f"Subscribed to topic: {MQTT_TOPIC}")
    else:
        print(f"Failed to connect to MQTT broker. Return code: {rc}")

def on_disconnect(client, userdata, rc):
    print(f"Disconnected from MQTT broker. Return code: {rc}")

# Main function
def main():
    print("Starting Elderly Monitoring MQTT Client...")
    
    # Setup MQTT client
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message
    
    try:
        # Connect to MQTT broker
        print(f"Connecting to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}")
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        
        # Setup medication reminders
        setup_medication_schedule(client)
        
        print("System ready. Monitoring elderly band data...")
        print("Available commands will be sent via serial to Arduino GSM module")
        print("- CALL:<number> for regular calls")
        print("- SOS:<number> for emergency (SMS + call)")
        
        # Start the MQTT loop
        client.loop_forever()
        
    except KeyboardInterrupt:
        print("\nShutting down gracefully...")
        client.disconnect()
        if ser:
            ser.close()
    except Exception as e:
        print(f"Error in main: {e}")
        if ser:
            ser.close()

if __name__ == '__main__':
    main()
