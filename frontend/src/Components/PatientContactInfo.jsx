import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, Shield, MapPin, Heart, AlertTriangle } from 'lucide-react';
import axios from 'axios';


const API_BASE_URL = 'http://localhost:8000/api';

function PatientContactInfo() {
    const [contact, setContact] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchContact = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await axios.get(`${API_BASE_URL}/patient-contact/`);
                // API returns an array, use the first item (or the default created one)
                if (response.data && response.data.length > 0) {
                    setContact(response.data[0]);
                } else {
                    setError("No patient contact information found.");
                }
            } catch (err) {
                console.error("Error fetching patient contact:", err);
                setError("Failed to load patient contact information. Is the backend server running and CORS configured?");
                if (err.response) {
                    setError(`Failed to load patient contact (Status: ${err.response.status}). Check console for details.`);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchContact();
    }, []);

    const handleEmergencyCall = (phone) => {
        alert(`Initiating emergency call to ${phone}`);
    };

    const handleDoctorCall = (phone) => {
        alert(`Calling doctor at ${phone}`);
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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <div className="text-center">
                <User className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading patient contact information...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                <p className="text-red-600">{error}</p>
            </div>
        </div>
    );

    if (!contact) return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <div className="text-center">
                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No contact information available.</p>
            </div>
        </div>
    );

    return (
        <div className="p-10">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <User className="w-8 h-8 text-blue-600" />
                        <h1 className="text-3xl font-bold text-gray-800">Patient & Emergency Contacts</h1>
                    </div>
                    <p className="text-gray-600">Contact information and emergency details</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Patient Information */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-6">
                            <User className="w-6 h-6 text-blue-600" />
                            <h2 className="text-xl font-bold text-gray-800">Patient Information</h2>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <User className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Full Name</p>
                                    <p className="text-lg font-semibold text-gray-800">{contact.patient_name}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Status</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        <span className="text-sm text-green-600 font-medium">Under Monitoring</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Doctor Information */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-6">
                            <Heart className="w-6 h-6 text-green-600" />
                            <h2 className="text-xl font-bold text-gray-800">Primary Doctor</h2>
                        </div>
                        
                        <div className="space-y-4 mb-6">
                            <div className="flex items-start gap-3">
                                <User className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Doctor Name</p>
                                    <p className="text-lg font-semibold text-gray-800">{contact.doctor_name}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-3">
                                <Phone className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Phone Number</p>
                                    <p className="text-lg font-semibold text-blue-600">{contact.doctor_phone}</p>
                                </div>
                            </div>
                            
                            {contact.doctor_email && (
                                <div className="flex items-start gap-3">
                                    <Mail className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-500">Email Address</p>
                                        <p className="text-lg font-semibold text-gray-800">{contact.doctor_email}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <ActionButton 
                            variant="green" 
                            onClick={() => handleDoctorCall(contact.doctor_phone)}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <Phone className="w-4 h-4" />
                                Call Doctor
                            </div>
                        </ActionButton>
                    </div>

                    {/* Emergency Contact */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3 mb-6">
                                <Shield className="w-6 h-6 text-red-500" />
                                <h2 className="text-xl font-bold text-gray-800">Emergency Contact</h2>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <User className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Contact Name</p>
                                            <p className="text-lg font-semibold text-gray-800">{contact.emergency_contact_name}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-start gap-3">
                                        <Phone className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Phone Number</p>
                                            <p className="text-lg font-semibold text-red-600">{contact.emergency_contact_phone}</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center">
                                    <ActionButton 
                                        variant="red" 
                                        onClick={() => handleEmergencyCall(contact.emergency_contact_phone)}
                                    >
                                        <div className="flex items-center justify-center gap-2">
                                            <Phone className="w-5 h-5" />
                                            Emergency Call
                                        </div>
                                    </ActionButton>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 flex justify-between items-center text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Contact Information Current</span>
                    </div>
                    <div className="flex gap-6">
                        <span>Emergency Services: 911</span>
                        <span>Medical Support: {contact.doctor_phone}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PatientContactInfo;