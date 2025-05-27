from rest_framework import generics, status
from rest_framework.response import Response
from .models import HealthData, PatientContact
from .serializers import HealthDataSerializer, PatientContactSerializer

class HealthDataPostView(generics.CreateAPIView):
    queryset=HealthData.objects.all()
    serializer_class= HealthDataSerializer

class LatestHealthDataView(generics.ListAPIView):
    serializer_class = HealthDataSerializer

    def get_queryset(self):
        latest_data = HealthData.objects.order_by('-timestamp').first()
        if latest_data:
            return HealthData.objects.filter(pk=latest_data.pk)
        return HealthData.objects.none()

class PatientContactView(generics.ListAPIView):
    serializer_class = PatientContactSerializer

    def get_queryset(self):
        contact = PatientContact.objects.first()
        if contact:
            return PatientContact.objects.filter(pk=contact.pk)
        return PatientContact.objects.none() 

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset() 

        if not queryset.exists(): 
            default_contact = PatientContact.objects.create(
                patient_name="test patient",
                patient_height="170 cm",
                patient_weight="70 kg",
                patient_age=30,
                patient_sex = "male",
                doctor_name="Dr. Smith",
                doctor_phone="123-456-7890",
                doctor_email="dr.smith@example.com",
                emergency_contact_name="Jhone Doe (son)",
                emergency_contact_phone="+919778235268"
            )
            serializer = self.get_serializer(default_contact) 
            return Response([serializer.data], status=status.HTTP_200_OK) 
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)