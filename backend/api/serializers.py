from rest_framework import serializers
from .models import HealthData, PatientContact

class HealthDataSerializer(serializers.ModelSerializer):
    class Meta:
        model=HealthData
        fields = ['id', 'timestamp', 'heart_rate', 'spo2', 'body_temp', 'fall_detected', 'blood_pressure']
        read_only_fields = ['timestamp', 'id'] 
class PatientContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientContact
        fields = "__all__"