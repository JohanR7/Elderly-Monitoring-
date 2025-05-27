from django.db import models

class HealthData(models.Model):
    timestamp = models.DateTimeField(auto_now_add=True)
    heart_rate = models.IntegerField(null=True, blank=True)
    spo2 = models.IntegerField(null=True, blank=True)
    body_temp = models.FloatField(null=True, blank=True)
    fall_detected = models.BooleanField(default=False)
    blood_pressure = models.CharField(max_length=25,  blank=True, null=True)

    def __str__(self):
        return f"Data at {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"

    class Meta:
        ordering = ['-timestamp']  # So latest data comes first


class PatientContact(models.Model):
    patient_name = models.CharField(max_length=100, default="Monitored Patient")
    patient_height = models.CharField(max_length=20, null=True, blank=True)
    patient_weight = models.CharField(max_length=20, null=True, blank=True)
    patient_age = models.IntegerField(null=True, blank=True)
    patient_sex = models.CharField(max_length=10,  blank=True, null=True)
    doctor_name = models.CharField(max_length=100)
    doctor_phone = models.CharField(max_length=20)
    doctor_email = models.EmailField(blank=True, null=True)
    emergency_contact_name = models.CharField(max_length=100)
    emergency_contact_phone = models.CharField(max_length=20)

    def __str__(self):
        return f"Contact for {self.patient_name}"
