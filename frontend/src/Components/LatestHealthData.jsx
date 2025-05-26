import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

function LatestHealthData() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await axios.get(`${API_BASE_URL}/health-data/latest/`);
                // The API returns an array, even if it's just one latest item
                if (response.data && response.data.length > 0) {
                    setData(response.data[0]);
                } else {
                    setData(null); // No data available
                }
            } catch (err) {
                console.error("Error fetching health data:", err);
                setError("Failed to load health data. Is the backend server running and CORS configured?");
                if (err.response) {
                    setError(`Failed to load health data (Status: ${err.response.status}). Check console for details.`);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        // Optional: Set up polling to refresh data every N seconds
        const intervalId = setInterval(fetchData, 30000); // Refresh every 30 seconds

        return () => clearInterval(intervalId); // Cleanup interval on component unmount
    }, []);

    if (loading) return <p className="loading">Loading latest health data...</p>;
    if (error) return <p className="error">{error}</p>;
    if (!data) return <p className="data-card">No health data available yet.</p>;

    return (
        <div className="data-card">
            <h3>Latest Health Vitals</h3>
            <p><strong>Timestamp:</strong> {new Date(data.timestamp).toLocaleString()}</p>
            <p><strong>Heart Rate:</strong> {data.heart_rate !== null ? `${data.heart_rate} bpm` : 'N/A'}</p>
            <p><strong>SpO2:</strong> {data.spo2 !== null ? `${data.spo2}%` : 'N/A'}</p>
            <p><strong>Body Temp:</strong> {data.body_temp !== null ? `${data.body_temp.toFixed(1)} °C` : 'N/A'}</p>
            <p>
                <strong>Fall Detected:</strong>
                <span className={data.fall_detected ? 'fall-detected-true' : 'fall-detected-false'}>
                    {data.fall_detected ? ' YES - ATTENTION REQUIRED!' : 'No'}
                </span>
            </p>
        </div>
    );
}

export default LatestHealthData;