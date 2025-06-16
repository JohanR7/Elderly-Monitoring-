from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
import uuid

class Device(models.Model):
    device_id = models.CharField(max_length=100, unique=True)
    device_name = models.CharField(max_length=100, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    last_activity = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Device {self.device_id}"
    
    def is_device_active(self):
        """Check if device is active based on last data timestamp"""
        if not self.last_activity:
            # Check if there's any health data for this device
            latest_data = self.health_data.first()
            if not latest_data:
                return False
            self.last_activity = latest_data.timestamp
            self.save()
        
        # Device is inactive if no data for more than 2 minutes
        inactive_threshold = timezone.now() - timedelta(minutes=2)
        return self.last_activity > inactive_threshold
    
    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = timezone.now()
        self.save()

class Patient(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='patients')
    patient_name = models.CharField(max_length=100)
    patient_height = models.CharField(max_length=20, null=True, blank=True)
    patient_weight = models.CharField(max_length=20, null=True, blank=True)
    patient_age = models.IntegerField(null=True, blank=True)
    patient_sex = models.CharField(max_length=10, blank=True, null=True)
    doctor_name = models.CharField(max_length=100)
    doctor_phone = models.CharField(max_length=20)
    doctor_email = models.EmailField(blank=True, null=True)
    emergency_contact_name = models.CharField(max_length=100)
    emergency_contact_phone = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Patient: {self.patient_name}"

class HealthData(models.Model):
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='health_data', null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    heart_rate = models.IntegerField(null=True, blank=True)
    spo2 = models.IntegerField(null=True, blank=True)
    body_temp = models.FloatField(null=True, blank=True)
    fall_detected = models.BooleanField(default=False)
    blood_pressure = models.CharField(max_length=25, blank=True, null=True)

    def __str__(self):
        device_id = self.device.device_id if self.device else "Unknown"
        return f"Data for {device_id} at {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Update device activity when new health data is saved
        if self.device:
            self.device.update_activity()

    class Meta:
        ordering = ['-timestamp']

# Keep for backward compatibility - will be deprecated
class PatientContact(models.Model):
    patient_name = models.CharField(max_length=100, default="Monitored Patient")
    patient_height = models.CharField(max_length=20, null=True, blank=True)
    patient_weight = models.CharField(max_length=20, null=True, blank=True)
    patient_age = models.IntegerField(null=True, blank=True)
    patient_sex = models.CharField(max_length=10, blank=True, null=True)
    doctor_name = models.CharField(max_length=100)
    doctor_phone = models.CharField(max_length=20)
    doctor_email = models.EmailField(blank=True, null=True)
    emergency_contact_name = models.CharField(max_length=100)
    emergency_contact_phone = models.CharField(max_length=20)

    def __str__(self):
        return f"Contact for {self.patient_name}"
