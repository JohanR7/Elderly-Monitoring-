from rest_framework import serializers
from .models import HealthData, PatientContact

class HealthDataSerializer(serializers.ModelSerializer):
    class Meta:
        model=HealthData
        fields = ['id', 'timestamp', 'heart_rate', 'spo2', 'body_temp', 'fall_detected']
        read_only_fields = ['timestamp', 'id'] 
class PatientContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientContact
        fields = ['id', 'patient_name', 'doctor_name', 'doctor_phone', 'doctor_email', 'emergency_contact_name', 'emergency_contact_phone']