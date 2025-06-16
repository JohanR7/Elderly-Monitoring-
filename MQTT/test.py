import paho.mqtt.client as mqtt
import json
import joblib
import serial
import time
import requests
from collections import deque

# MQTT config
MQTT_BROKER = 'localhost'
MQTT_PORT = 1883
MQTT_TOPIC = 'elder_band/data'

# Serial config (update to your Arduino port)
SERIAL_PORT = '/dev/ttyACM0' # Change to your Arduino serial port
BAUD_RATE = 9600

# Load trained model
model = joblib.load('sbp_rf_model_realdata.joblib')

# Patient info defaults (will override from API)
patient_info = {
    'age': 30,
    'sex': 1,  # 0 or 1 encoding; update if needed
}

# Buffer & emergency counter
buffer = deque(maxlen=5)
emergency_count = 0
emergency_contact_phone = None

# Setup serial connection
ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
time.sleep(2)  # wait for serial to initialize

def fetch_emergency_contact():
    global emergency_contact_phone, patient_info
    try:
        response = requests.get("http://127.0.0.1:8000/api/patient-contact/")
        response.raise_for_status()
        data = response.json()

        # Extract and print patient info if available
        patient_info['age'] = data.get('patient_age', patient_info['age'])
        # If you have sex in API, add here similarly: 
        patient_info['sex'] = data.get('patient_sex', patient_info['sex'])

        emergency_contact_phone = data.get('emergency_contact_phone')
        if emergency_contact_phone:
            print(f"Fetched emergency contact phone: {emergency_contact_phone}")
        else:
            print("Emergency contact phone not found in API response.")
    except Exception as e:
        print(f"Failed to fetch emergency contact: {e}")

def process_and_predict(messages):
    avg_hr = sum(m['heartRate'] for m in messages) / len(messages)
    avg_spo2 = sum(m['spo2'] for m in messages) / len(messages)
    avg_temp_c = sum(m['temperature'] for m in messages) / len(messages)

    X = [[
        patient_info['age'],
        avg_hr,
        avg_spo2,
        avg_temp_c,
    ]]

    predicted_sbp = model.predict(X)[0]
    print(f'Predicted SBP: {predicted_sbp:.2f}')

def on_message(client, userdata, msg):
    global buffer, emergency_count, ser, emergency_contact_phone

    try:
        data = json.loads(msg.payload.decode())
        buffer.append(data)

        if len(buffer) == 5:
            process_and_predict(buffer)

        if data.get('emergency'):
            emergency_count += 1
            print(f'Emergency count: {emergency_count}')
            if emergency_count >= 5:
                if emergency_contact_phone is None:
                    fetch_emergency_contact()
                if emergency_contact_phone:
                    cmd = f"CALL {emergency_contact_phone}\n"
                    ser.write(cmd.encode())
                    print(f"Sent call command: {cmd.strip()}")
                else:
                    print("No emergency contact phone to call.")
                emergency_count = 0
        else:
            emergency_count = 0

    except Exception as e:
        print(f"Error processing MQTT message: {e}")

def main():
    client = mqtt.Client()
    client.on_message = on_message

    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.subscribe(MQTT_TOPIC)

    print(f"Subscribed to MQTT topic '{MQTT_TOPIC}', waiting for data...")
    client.loop_forever()

if __name__ == '__main__':
    main()
