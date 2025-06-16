from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from .models import HealthData, PatientContact, Patient, Device
from .serializers import (
    HealthDataSerializer, PatientContactSerializer, 
    PatientSerializer, DeviceSerializer, UserSerializer
)

@api_view(['POST'])
@permission_classes([AllowAny])
def register_patient(request):
    serializer = PatientSerializer(data=request.data)
    if serializer.is_valid():
        patient = serializer.save()
        token, created = Token.objects.get_or_create(user=patient.user)
        return Response({
            'patient': PatientSerializer(patient).data,
            'token': token.key,
            'user_id': patient.user.id
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    
    if username and password:
        user = authenticate(username=username, password=password)
        if user:
            token, created = Token.objects.get_or_create(user=user)
            try:
                patient = Patient.objects.get(user=user)
                return Response({
                    'token': token.key,
                    'user_id': user.id,
                    'patient': PatientSerializer(patient).data
                })
            except Patient.DoesNotExist:
                return Response({
                    'error': 'Patient profile not found'
                }, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({
                'error': 'Invalid credentials'
            }, status=status.HTTP_401_UNAUTHORIZED)
    else:
        return Response({
            'error': 'Username and password required'
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    try:
        request.user.auth_token.delete()
        return Response({'message': 'Successfully logged out'})
    except:
        return Response({'error': 'Error logging out'}, status=status.HTTP_400_BAD_REQUEST)

class HealthDataPostView(generics.CreateAPIView):
    queryset = HealthData.objects.all()
    serializer_class = HealthDataSerializer
    permission_classes = [AllowAny]  # Allow devices to post data without authentication

class LatestHealthDataView(generics.ListAPIView):
    serializer_class = HealthDataSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        try:
            patient = Patient.objects.get(user=self.request.user)
            latest_data = HealthData.objects.filter(device=patient.device).order_by('-timestamp').first()
            if latest_data:
                return HealthData.objects.filter(pk=latest_data.pk)
            return HealthData.objects.none()
        except Patient.DoesNotExist:
            return HealthData.objects.none()

class PatientHealthHistoryView(generics.ListAPIView):
    serializer_class = HealthDataSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        try:
            patient = Patient.objects.get(user=self.request.user)
            return HealthData.objects.filter(device=patient.device).order_by('-timestamp')[:50]
        except Patient.DoesNotExist:
            return HealthData.objects.none()

class PatientProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        return Patient.objects.get(user=self.request.user)

class PatientContactView(generics.ListAPIView):
    serializer_class = PatientContactSerializer
    permission_classes = [AllowAny]

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
                patient_sex="male",
                doctor_name="Dr. Smith",
                doctor_phone="123-456-7890",
                doctor_email="dr.smith@example.com",
                emergency_contact_name="John Doe (son)",
                emergency_contact_phone="+919778235268"
            )
            serializer = self.get_serializer(default_contact) 
            return Response([serializer.data], status=status.HTTP_200_OK) 
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

# New authenticated patient contact view
class AuthenticatedPatientContactView(generics.RetrieveAPIView):
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        return Patient.objects.get(user=self.request.user)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_patient_by_device(request, device_id):
    """Get patient information by device ID for MQTT client"""
    try:
        device = Device.objects.get(device_id=device_id)
        patient = Patient.objects.get(device=device)
        
        return Response({
            'device_id': device.device_id,
            'patient_name': patient.patient_name,
            'patient_age': patient.patient_age,
            'patient_sex': patient.patient_sex,
            'emergency_contact_phone': patient.emergency_contact_phone,
            'doctor_phone': patient.doctor_phone,
            'doctor_name': patient.doctor_name,
            'last_activity': device.last_activity,
            'is_active': device.is_device_active()
        })
    except Device.DoesNotExist:
        return Response({
            'error': 'Device not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Patient.DoesNotExist:
        return Response({
            'error': 'Patient not found for this device'
        }, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([AllowAny])  
def log_emergency_event(request):
    """Log emergency events from MQTT client"""
    try:
        device_id = request.data.get('device_id')
        event_type = request.data.get('event_type', 'emergency')  # 'emergency', 'call', 'fall'
        details = request.data.get('details', {})
        
        if not device_id:
            return Response({
                'error': 'device_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        device, created = Device.objects.get_or_create(
            device_id=device_id,
            defaults={'device_name': f'Device {device_id}'}
        )
        
        # Create a health data entry to log the event
        health_data = HealthData.objects.create(
            device=device,
            heart_rate=details.get('heart_rate'),
            spo2=details.get('spo2'),
            body_temp=details.get('body_temp'),
            fall_detected=details.get('fall_detected', False),
            blood_pressure=details.get('blood_pressure')
        )
        
        return Response({
            'id': health_data.id,
            'message': f'{event_type} event logged successfully',
            'timestamp': health_data.timestamp
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Updated device status view to accept device_id parameter
@api_view(['GET'])
@permission_classes([AllowAny])  # Allow MQTT client to check any device
def device_status_by_id(request, device_id):
    """Check device status by device ID"""
    try:
        device = Device.objects.get(device_id=device_id)
        
        is_active = device.is_device_active()
        last_activity = device.last_activity
        
        # Get associated patient info if available
        patient_info = None
        try:
            patient = Patient.objects.get(device=device)
            patient_info = {
                'name': patient.patient_name,
                'age': patient.patient_age,
                'emergency_contact': patient.emergency_contact_phone
            }
        except Patient.DoesNotExist:
            pass
        
        return Response({
            'device_id': device.device_id,
            'is_active': is_active,
            'last_activity': last_activity,
            'status': 'active' if is_active else 'inactive',
            'patient': patient_info
        })
    except Device.DoesNotExist:
        return Response({
            'error': 'Device not found'
        }, status=status.HTTP_404_NOT_FOUND)

# Keep the original device_status view for authenticated users
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def device_status(request):
    """Check if the user's device is active (received data in last 2 minutes)"""
    try:
        patient = Patient.objects.get(user=request.user)
        device = patient.device
        
        is_active = device.is_device_active()
        last_activity = device.last_activity
        
        return Response({
            'device_id': device.device_id,
            'is_active': is_active,
            'last_activity': last_activity,
            'status': 'active' if is_active else 'inactive'
        })
    except Patient.DoesNotExist:
        return Response({
            'error': 'Patient profile not found'
        }, status=status.HTTP_404_NOT_FOUND)