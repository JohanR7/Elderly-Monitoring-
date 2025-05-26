import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

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

    if (loading) return <p className="loading">Loading patient contact information...</p>;
    if (error) return <p className="error">{error}</p>;
    if (!contact) return <p className="contact-card">No contact information available.</p>;

    return (
        <div className="contact-card">
            <h3>Patient & Emergency Contact</h3>
            <p><strong>Patient Name:</strong> {contact.patient_name}</p>
            <h4>Doctor Information</h4>
            <p><strong>Doctor Name:</strong> {contact.doctor_name}</p>
            <p><strong>Doctor Phone:</strong> {contact.doctor_phone}</p>
            <p><strong>Doctor Email:</strong> {contact.doctor_email || 'N/A'}</p>
            <h4>Emergency Contact</h4>
            <p><strong>Contact Name:</strong> {contact.emergency_contact_name}</p>
            <p><strong>Contact Phone:</strong> {contact.emergency_contact_phone}</p>
        </div>
    );
}

export default PatientContactInfo;