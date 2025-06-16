from django.urls import path
from .views import (
    HealthDataPostView, LatestHealthDataView, PatientContactView,
    register_patient, login, logout, PatientHealthHistoryView,
    PatientProfileView, AuthenticatedPatientContactView, device_status,
    get_patient_by_device, log_emergency_event, device_status_by_id
)

urlpatterns = [
    # Authentication
    path('auth/register/', register_patient, name='register-patient'),
    path('auth/login/', login, name='login'),
    path('auth/logout/', logout, name='logout'),
    
    # Health Data
    path('health-data/', HealthDataPostView.as_view(), name='health-data-post'),
    path('health-data/latest/', LatestHealthDataView.as_view(), name='latest-health-data'),
    path('health-data/history/', PatientHealthHistoryView.as_view(), name='health-data-history'),
    
    # Device Status
    path('device/status/', device_status, name='device-status'),
    path('device/<str:device_id>/status/', device_status_by_id, name='device-status-by-id'),
    path('device/<str:device_id>/patient/', get_patient_by_device, name='patient-by-device'),
    
    # Emergency Events
    path('emergency/log/', log_emergency_event, name='log-emergency-event'),
    
    # Patient Info
    path('patient/profile/', PatientProfileView.as_view(), name='patient-profile'),
    path('patient/contact/', AuthenticatedPatientContactView.as_view(), name='authenticated-patient-contact'),
    
    # Legacy endpoints (for backward compatibility)
    path('patient-contact/', PatientContactView.as_view(), name='patient-contact'),
]