import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, Shield, MapPin, Heart, AlertTriangle, Edit, Save, X } from 'lucide-react';
import { useAuth } from './AuthContext';

function PatientContactInfo() {
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedData, setEditedData] = useState({});
    const { user, token } = useAuth();

    useEffect(() => {
        const fetchPatientProfile = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch('/api/patient/profile/', {
                    headers: {
                        'Authorization': `Token ${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    setPatient(data);
                    setEditedData(data);
                } else {
                    setError("Failed to load patient profile.");
                }
            } catch (err) {
                console.error("Error fetching patient profile:", err);
                setError("Failed to load patient profile. Please check your connection.");
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchPatientProfile();
        }
    }, [token]);

    const handleEmergencyCall = (phone) => {
        const confirmCall = window.confirm(`Call emergency contact at ${phone}?`);
        if (confirmCall) {
            window.open(`tel:${phone}`);
        }
    };

    const handleDoctorCall = (phone) => {
        const confirmCall = window.confirm(`Call doctor at ${phone}?`);
        if (confirmCall) {
            window.open(`tel:${phone}`);
        }
    };

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditedData(patient);
    };

    const handleSave = async () => {
        try {
            const response = await fetch('/api/patient/profile/', {
                method: 'PATCH',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(editedData),
            });

            if (response.ok) {
                const updatedData = await response.json();
                setPatient(updatedData);
                setIsEditing(false);
            } else {
                setError("Failed to update patient profile.");
            }
        } catch (err) {
            console.error("Error updating patient profile:", err);
            setError("Failed to update patient profile.");
        }
    };

    const handleChange = (field, value) => {
        setEditedData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const ActionButton = ({ children, variant, onClick }) => {
        const baseClasses = "w-full py-3 px-4 rounded-lg font-medium text-white transition-colors duration-200";
        const variants = {
            blue: "bg-blue-500 hover:bg-blue-600",
            green: "bg-green-500 hover:bg-green-600",
            purple: "bg-purple-500 hover:bg-purple-600",
            red: "bg-red-500 hover:bg-red-600"
        };
        return (
            <button
                className={`${baseClasses} ${variants[variant]}`}
                onClick={onClick}
            >
                {children}
            </button>
        );
    };

    if (loading) return (
        <div className="flex items-center justify-center p-8">
            <div className="text-center">
                <User className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading patient information...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="flex items-center justify-center p-8">
            <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                <p className="text-red-600">{error}</p>
            </div>
        </div>
    );

    if (!patient) return (
        <div className="flex items-center justify-center p-8">
            <div className="text-center">
                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No patient information available.</p>
            </div>
        </div>
    );

    const EditableField = ({ label, value, field, type = "text" }) => (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            {isEditing ? (
                type === "select" ? (
                    <select
                        value={editedData[field] || ''}
                        onChange={(e) => handleChange(field, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                    </select>
                ) : (
                    <input
                        type={type}
                        value={editedData[field] || ''}
                        onChange={(e) => handleChange(field, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                )
            ) : (
                <p className="text-gray-800 font-medium">{value || 'Not provided'}</p>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Patient Profile</h1>
                        <p className="text-gray-600">Manage patient information and contacts</p>
                    </div>
                    <div className="flex gap-2">
                        {isEditing ? (
                            <>
                                <button
                                    onClick={handleSave}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    <Save className="w-4 h-4" />
                                    Save
                                </button>
                                <button
                                    onClick={handleCancel}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleEdit}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Edit className="w-4 h-4" />
                                Edit Profile
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Patient Information */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-6">
                        <User className="w-6 h-6 text-blue-600" />
                        <h2 className="text-xl font-semibold text-gray-800">Patient Information</h2>
                    </div>
                    
                    <div className="space-y-4">
                        <EditableField 
                            label="Full Name" 
                            value={patient.patient_name} 
                            field="patient_name" 
                        />
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <EditableField 
                                label="Age" 
                                value={patient.patient_age} 
                                field="patient_age" 
                                type="number"
                            />
                            <EditableField 
                                label="Sex" 
                                value={patient.patient_sex} 
                                field="patient_sex" 
                                type="select"
                            />
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <EditableField 
                                label="Height" 
                                value={patient.patient_height} 
                                field="patient_height" 
                            />
                            <EditableField 
                                label="Weight" 
                                value={patient.patient_weight} 
                                field="patient_weight" 
                            />
                        </div>

                        <div className="pt-4 border-t border-gray-200">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">Device ID</span>
                                <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded">
                                    {patient.device_info?.device_id || 'Not assigned'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-sm font-medium text-gray-700">Device Status</span>
                                <span className={`text-sm px-3 py-1 rounded-full ${
                                    patient.device_info?.is_active 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-red-100 text-red-800'
                                }`}>
                                    {patient.device_info?.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Medical Team */}
                <div className="space-y-6">
                    {/* Doctor Information */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-6">
                            <Shield className="w-6 h-6 text-green-600" />
                            <h2 className="text-xl font-semibold text-gray-800">Primary Doctor</h2>
                        </div>
                        
                        <div className="space-y-4">
                            <EditableField 
                                label="Doctor Name" 
                                value={patient.doctor_name} 
                                field="doctor_name" 
                            />
                            <EditableField 
                                label="Phone Number" 
                                value={patient.doctor_phone} 
                                field="doctor_phone" 
                                type="tel"
                            />
                            <EditableField 
                                label="Email Address" 
                                value={patient.doctor_email} 
                                field="doctor_email" 
                                type="email"
                            />
                        </div>

                        {!isEditing && (
                            <div className="mt-6">
                                <ActionButton 
                                    variant="green" 
                                    onClick={() => handleDoctorCall(patient.doctor_phone)}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <Phone className="w-4 h-4" />
                                        Call Doctor
                                    </div>
                                </ActionButton>
                            </div>
                        )}
                    </div>

                    {/* Emergency Contact */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-6">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                            <h2 className="text-xl font-semibold text-gray-800">Emergency Contact</h2>
                        </div>
                        
                        <div className="space-y-4">
                            <EditableField 
                                label="Contact Name" 
                                value={patient.emergency_contact_name} 
                                field="emergency_contact_name" 
                            />
                            <EditableField 
                                label="Phone Number" 
                                value={patient.emergency_contact_phone} 
                                field="emergency_contact_phone" 
                                type="tel"
                            />
                        </div>

                        {!isEditing && (
                            <div className="mt-6">
                                <ActionButton 
                                    variant="red" 
                                    onClick={() => handleEmergencyCall(patient.emergency_contact_phone)}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <Phone className="w-4 h-4" />
                                        Emergency Call
                                    </div>
                                </ActionButton>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Account Information */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                    <Mail className="w-6 h-6 text-purple-600" />
                    <h2 className="text-xl font-semibold text-gray-800">Account Information</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                        <p className="text-gray-800 font-medium">{user?.username || 'Not available'}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <p className="text-gray-800 font-medium">{user?.email || 'Not provided'}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Registration Date</label>
                        <p className="text-gray-800 font-medium">
                            {patient.created_at ? new Date(patient.created_at).toLocaleDateString() : 'Not available'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PatientContactInfo;