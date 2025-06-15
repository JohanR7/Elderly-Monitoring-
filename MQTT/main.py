import paho.mqtt.client as mqtt
import json
import joblib
import serial
import time
import requests
import random
from collections import deque
from apscheduler.schedulers.background import BackgroundScheduler

# MQTT config
MQTT_BROKER = 'localhost'
MQTT_PORT = 1883
MQTT_TOPIC = 'elder_band/data'
MEDICATION_TOPIC = 'elder_band/medication'

# Serial config
SERIAL_PORT = '/dev/ttyACM0'
BAUD_RATE = 9600

# Load model
model = joblib.load('sbp_rf_model_realdata.joblib')

# Patient info
patient_info = {
    'age': 30,
    'sex': 1,
}

# Buffers and state
buffer = deque(maxlen=5)
emergency_count = 0
emergency_contact_phone = None

# Random medication list
medications = [
    "Amlodipine 5mg", "Metformin 500mg", "Atorvastatin 10mg",
    "Losartan 50mg", "Enalapril 10mg", "Paracetamol 500mg"
]

# Initialize serial
ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
time.sleep(2)
ser.write(b"CALL +919778235268\n")
print("Test call command sent: CALL +919778235268")

# Fetch emergency contact from Django backend
def fetch_emergency_contact():
    global emergency_contact_phone, patient_info
    try:
        response = requests.get("http://127.0.0.1:8000/api/patient-contact/")
        response.raise_for_status()
        data = response.json()
        if isinstance(data, list) and data:
            data = data[0]
        patient_info['age'] = data.get('patient_age', patient_info['age'])
        patient_info['sex'] = data.get('patient_sex', patient_info['sex'])
        emergency_contact_phone = data.get('emergency_contact_phone')
        if emergency_contact_phone:
            print(f"Fetched emergency contact: {emergency_contact_phone}")
    except Exception as e:
        print(f"Failed to fetch emergency contact: {e}")

# Post health data to backend
def post_to_backend(hr, spo2, temp, fall, bp):
    try:
        payload = {
            "heart_rate": int(hr),
            "spo2": int(spo2),
            "body_temp": round(temp, 2),
            "fall_detected": fall,
            "blood_pressure": str(round(bp, 2))
        }
        response = requests.post("http://127.0.0.1:8000/api/health-data/", json=payload)
        response.raise_for_status()
        print(f"Posted to backend: {payload}")
    except Exception as e:
        print(f"Failed to post to backend: {e}")

# Predict BP and handle data posting
def process_and_predict(messages):
    avg_hr = sum(m['heartRate'] for m in messages) / len(messages)
    avg_spo2 = sum(m['spo2'] for m in messages) / len(messages)
    avg_temp = sum(m['temperature'] for m in messages) / len(messages)
    fall_any = any(m.get('fallDetected', False) for m in messages)

    X = [[patient_info['age'], avg_hr, avg_spo2, avg_temp]]
    predicted_sbp = model.predict(X)[0]
    print(f"Predicted SBP: {predicted_sbp:.2f}")
    post_to_backend(avg_hr, avg_spo2, avg_temp, fall_any, predicted_sbp)

# Handle incoming MQTT messages
def on_message(client, userdata, msg):
    global buffer, emergency_count, ser, emergency_contact_phone

    try:
        data = json.loads(msg.payload.decode())
        buffer.append(data)

        # Process every 5 messages
        if len(buffer) == 5:
            process_and_predict(list(buffer))
            buffer.clear()

        # Handle emergency signal
        if data.get('emergency'):
            emergency_count += 1
            print(f"Emergency count: {emergency_count}")
            if emergency_count >= 5:
                if emergency_contact_phone is None:
                    fetch_emergency_contact()
                if emergency_contact_phone:
                    cmd = f"CALL {emergency_contact_phone}\n"
                    ser.write(cmd.encode())
                    print(f"Sent CALL command: {cmd.strip()}")
                else:
                    print("No emergency contact phone to call.")
                emergency_count = 0
        else:
            emergency_count = 0

    except Exception as e:
        print(f"Error processing message: {e}")

# Publish medication reminder
def send_medication_reminder(client, label):
    message = {
        "type": "medication",
        "medicine": random.choice(medications),
        "time": label
    }
    client.publish(MEDICATION_TOPIC, json.dumps(message))
    print(f"Sent medication reminder: {message}")

# Setup medication reminder scheduler
def setup_medication_schedule(client):
    scheduler = BackgroundScheduler()
    scheduler.add_job(lambda: send_medication_reminder(client, "morning"), 'cron', hour=9, minute=0)
    scheduler.add_job(lambda: send_medication_reminder(client, "night"), 'cron', hour=21, minute=0)
    scheduler.start()

# Entry point
def main():
    client = mqtt.Client()
    client.on_message = on_message
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.subscribe(MQTT_TOPIC)

    setup_medication_schedule(client)

    print(f"Subscribed to '{MQTT_TOPIC}' and waiting for data...")
    client.loop_forever()

if __name__ == '__main__':
    main()
