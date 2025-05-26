from django.urls import path
from .views import HealthDataPostView, LatestHealthDataView, PatientContactView

urlpatterns = [
    path('health-data/', HealthDataPostView.as_view(), name='health-data-post'),
    path('health-data/latest/', LatestHealthDataView.as_view(), name='latest-health-data'),
    path('patient-contact/', PatientContactView.as_view(), name='patient-contact'),
]