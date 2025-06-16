#!/usr/bin/env python3
"""
Test script for Elderly Monitoring System
Tests all components: Backend API, MQTT, Device simulation
"""

import requests
import json
import time
import subprocess
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "http://127.0.0.1:8000/api"
MQTT_BROKER = "localhost"
TEST_DEVICE_ID = "TEST:DEVICE:001"

def print_status(message, success=True):
    """Print formatted status message"""
    symbol = "✅" if success else "❌"
    print(f"{symbol} {message}")

def test_backend_connection():
    """Test if Django backend is running"""
    try:
        response = requests.get(f"{BACKEND_URL}/patient-contact/", timeout=5)
        if response.status_code == 200:
            print_status("Backend API is accessible")
            return True
        else:
            print_status(f"Backend returned status {response.status_code}", False)
            return False
    except requests.exceptions.RequestException as e:
        print_status(f"Backend connection failed: {e}", False)
        return False

def test_mqtt_broker():
    """Test if MQTT broker is running"""
    try:
        result = subprocess.run(
            ["mosquitto_pub", "-h", MQTT_BROKER, "-t", "test", "-m", "test"],
            capture_output=True, timeout=5
        )
        if result.returncode == 0:
            print_status("MQTT broker is accessible")
            return True
        else:
            print_status("MQTT broker connection failed", False)
            return False
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        print_status(f"MQTT test failed: {e}", False)
        return False

def register_test_patient():
    """Register a test patient"""
    try:
        patient_data = {
            "username": f"testpatient_{int(time.time())}",
            "password": "testpass123",
            "email": "test@example.com",
            "device_id": TEST_DEVICE_ID,
            "patient_name": "Test Patient",
            "patient_age": 65,
            "patient_sex": "male",
            "patient_height": "175 cm",
            "patient_weight": "70 kg",
            "doctor_name": "Dr. Test",
            "doctor_phone": "123-456-7890",
            "doctor_email": "dr.test@example.com",
            "emergency_contact_name": "Emergency Contact",
            "emergency_contact_phone": "+919778235268"
        }
        
        response = requests.post(f"{BACKEND_URL}/auth/register/", json=patient_data)
        if response.status_code == 201:
            print_status("Test patient registered successfully")
            return response.json()
        else:
            print_status(f"Patient registration failed: {response.text}", False)
            return None
    except Exception as e:
        print_status(f"Patient registration error: {e}", False)
        return None

def test_health_data_post():
    """Test posting health data"""
    try:
        health_data = {
            "device_id": TEST_DEVICE_ID,
            "heart_rate": 72,
            "spo2": 98,
            "body_temp": 36.5,
            "fall_detected": False,
            "blood_pressure": "120"
        }
        
        response = requests.post(f"{BACKEND_URL}/health-data/", json=health_data)
        if response.status_code == 201:
            print_status("Health data posted successfully")
            return True
        else:
            print_status(f"Health data post failed: {response.text}", False)
            return False
    except Exception as e:
        print_status(f"Health data post error: {e}", False)
        return False

def test_device_patient_endpoint():
    """Test device-specific patient endpoint"""
    try:
        response = requests.get(f"{BACKEND_URL}/device/{TEST_DEVICE_ID}/patient/")
        if response.status_code == 200:
            data = response.json()
            print_status(f"Device patient data retrieved: {data['patient_name']}")
            return True
        else:
            print_status(f"Device endpoint failed: {response.text}", False)
            return False
    except Exception as e:
        print_status(f"Device endpoint error: {e}", False)
        return False

def simulate_esp32_messages():
    """Simulate ESP32 MQTT messages"""
    messages = [
        # Normal message
        {
            "deviceId": TEST_DEVICE_ID,
            "heartRate": 72,
            "spo2": 98,
            "temperature": 36.5,
            "fall": False,
            "emergency": False,
            "fingerDetected": True,
            "call": False,
            "medicationReminder": False,
            "timestamp": int(time.time()),
            "freeHeap": 45000
        },
        # Emergency message
        {
            "deviceId": TEST_DEVICE_ID,
            "heartRate": 150,
            "spo2": 85,
            "temperature": 38.5,
            "fall": True,
            "emergency": True,
            "fingerDetected": True,
            "call": False,
            "medicationReminder": False,
            "timestamp": int(time.time()),
            "freeHeap": 44000
        },
        # Call button message
        {
            "deviceId": TEST_DEVICE_ID,
            "heartRate": 75,
            "spo2": 97,
            "temperature": 36.8,
            "fall": False,
            "emergency": False,
            "fingerDetected": True,
            "call": True,
            "medicationReminder": False,
            "timestamp": int(time.time()),
            "freeHeap": 43000
        }
    ]
    
    print("📡 Sending test MQTT messages...")
    for i, message in enumerate(messages):
        try:
            cmd = [
                "mosquitto_pub", 
                "-h", MQTT_BROKER,
                "-t", "elder_band/data",
                "-m", json.dumps(message)
            ]
            result = subprocess.run(cmd, capture_output=True, timeout=5)
            if result.returncode == 0:
                msg_type = "Normal" if i == 0 else "Emergency" if i == 1 else "Call Button"
                print_status(f"Sent {msg_type} message")
            else:
                print_status(f"Failed to send message {i}", False)
            time.sleep(1)
        except Exception as e:
            print_status(f"MQTT message {i} failed: {e}", False)

def test_medication_reminder():
    """Test medication reminder"""
    try:
        cmd = [
            "mosquitto_pub",
            "-h", MQTT_BROKER,
            "-t", "elder_band/medication", 
            "-m", "true"
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=5)
        if result.returncode == 0:
            print_status("Medication reminder sent")
            return True
        else:
            print_status("Medication reminder failed", False)
            return False
    except Exception as e:
        print_status(f"Medication reminder error: {e}", False)
        return False

def main():
    """Run all tests"""
    print("🏥 Elderly Monitoring System Test Suite")
    print("=" * 50)
    
    # Test backend
    print("\n📋 Testing Backend...")
    if not test_backend_connection():
        print("❌ Backend is not running. Start with: cd backend && python manage.py runserver 8000")
        return False
    
    # Test MQTT broker
    print("\n📡 Testing MQTT Broker...")
    if not test_mqtt_broker():
        print("❌ MQTT broker is not running. Start with: mosquitto -v")
        return False
    
    # Register test patient
    print("\n👤 Testing Patient Registration...")
    patient = register_test_patient()
    if not patient:
        return False
    
    # Test health data
    print("\n💓 Testing Health Data...")
    if not test_health_data_post():
        return False
    
    # Test device endpoints
    print("\n🔍 Testing Device Endpoints...")
    if not test_device_patient_endpoint():
        return False
    
    # Test MQTT messages
    print("\n📱 Testing ESP32 Simulation...")
    simulate_esp32_messages()
    
    # Test medication reminder
    print("\n💊 Testing Medication Reminder...")
    test_medication_reminder()
    
    print("\n✅ All tests completed!")
    print("\n📝 To test MQTT client processing:")
    print("   1. Start MQTT client: cd MQTT && source venv/bin/activate && python main.py")
    print("   2. Run this test again to see message processing")
    print("\n🔧 Hardware Integration:")
    print("   - Flash ESP32 with main.ino")
    print("   - Connect Arduino GSM module")
    print("   - Update WiFi/MQTT settings in ESP32 code")
    
    return True

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️ Test interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Test failed with error: {e}")
        sys.exit(1)
