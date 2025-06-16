from rest_framework import serializers
from django.contrib.auth.models import User
from .models import HealthData, PatientContact, Patient, Device

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'first_name', 'last_name')
    
    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        return user

class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = ['id', 'device_id', 'device_name', 'is_active', 'created_at']

class PatientSerializer(serializers.ModelSerializer):
    device_id = serializers.CharField(write_only=True)
    device_info = DeviceSerializer(source='device', read_only=True)
    username = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True)
    email = serializers.EmailField(write_only=True)
    
    class Meta:
        model = Patient
        fields = [
            'id', 'patient_name', 'patient_height', 'patient_weight', 
            'patient_age', 'patient_sex', 'doctor_name', 'doctor_phone', 
            'doctor_email', 'emergency_contact_name', 'emergency_contact_phone',
            'device_id', 'device_info', 'username', 'password', 'email', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def create(self, validated_data):
        device_id = validated_data.pop('device_id')
        username = validated_data.pop('username')
        password = validated_data.pop('password')
        email = validated_data.pop('email')
        
        # Create or get device
        device, created = Device.objects.get_or_create(
            device_id=device_id,
            defaults={'device_name': f'Device {device_id}'}
        )
        
        # Create user
        user = User.objects.create_user(
            username=username,
            password=password,
            email=email,
            first_name=validated_data.get('patient_name', '').split()[0] if validated_data.get('patient_name') else ''
        )
        
        # Create patient
        patient = Patient.objects.create(
            user=user,
            device=device,
            **validated_data
        )
        
        return patient

class HealthDataSerializer(serializers.ModelSerializer):
    device_id = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = HealthData
        fields = ['id', 'timestamp', 'heart_rate', 'spo2', 'body_temp', 'fall_detected', 'blood_pressure', 'device_id']
        read_only_fields = ['timestamp', 'id']
    
    def create(self, validated_data):
        device_id = validated_data.pop('device_id')
        try:
            device = Device.objects.get(device_id=device_id)
        except Device.DoesNotExist:
            device = Device.objects.create(device_id=device_id, device_name=f'Device {device_id}')
        
        return HealthData.objects.create(device=device, **validated_data)

class PatientContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientContact
        fields = "__all__"