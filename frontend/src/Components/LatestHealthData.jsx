import React, { useState, useEffect } from 'react';
import { Heart, Activity, Thermometer, Shield, Phone, MapPin, User, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { useAuth } from './AuthContext';

function LatestHealthData() {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [historicalData, setHistoricalData] = useState([]);
    const [deviceStatus, setDeviceStatus] = useState({ is_active: true, status: 'active' });
    const { user, token } = useAuth();

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-IN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch both health data and device status
                const [healthResponse, statusResponse] = await Promise.all([
                    fetch('/api/health-data/latest/', {
                        headers: {
                            'Authorization': `Token ${token}`,
                            'Content-Type': 'application/json',
                        },
                    }),
                    fetch('/api/device/status/', {
                        headers: {
                            'Authorization': `Token ${token}`,
                            'Content-Type': 'application/json',
                        },
                    })
                ]);

                if (!healthResponse.ok) {
                    throw new Error(`HTTP error! Status: ${healthResponse.status}`);
                }

                const responseData = await healthResponse.json();
                
                // Update device status if available
                if (statusResponse.ok) {
                    const statusData = await statusResponse.json();
                    setDeviceStatus(statusData);
                }

                if (responseData && responseData.length > 0) {
                    const latestData = responseData[0];
                    setData(latestData);

                    const newDataPoint = {
                        time: new Date(latestData.timestamp).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit'
                        }),
                        spO2: latestData.spo2,
                        heartRate: latestData.heart_rate,
                        bodyTemp: latestData.body_temp
                    };

                    setHistoricalData(prev => {
                        const updated = [...prev, newDataPoint];
                        return updated.slice(-10);
                    });
                } else {
                    setData(null);
                }
            } catch (err) {
                console.error("Error fetching health data:", err);
                setError("Failed to load health data. Please check your connection.");
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchData();
            const intervalId = setInterval(fetchData, 30000);
            return () => clearInterval(intervalId);
        }
    }, [token]);


    const handleEmergencyCall = () => {
        if (user?.doctor_phone) {
            const confirmCall = window.confirm(`Call ${user.doctor_name || 'Doctor'} at ${user.doctor_phone}?`);
            if (confirmCall) {
                window.open(`tel:${user.doctor_phone}`);
            }
        } else {
            alert('Doctor contact information not available');
        }
    };

    const handleViewHistory = () => {
        alert('Opening medical history...');
    };

    const handleSendMessage = () => {
        alert('Sending check-in message to patient...');
    };

    const handleScheduleAppointment = () => {
        alert('Opening appointment scheduler...');
    };

    const VitalCard = ({ icon: Icon, title, value, unit, status, color, isAlert = false }) => (
        <div className={`bg-white rounded-xl p-6 shadow-sm border ${isAlert ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
            <div className="flex items-center gap-3 mb-4">
                <Icon className={`w-5 h-5 ${color}`} />
                <span className="text-gray-600 text-sm font-medium">{title}</span>
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-800">{value}</span>
                <span className="text-lg text-gray-500">{unit}</span>
            </div>
            <div className="mt-2">
                <span className={`text-sm font-medium ${isAlert ? 'text-red-600' : status === 'Normal' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {status}
                </span>
            </div>
        </div>
    );

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

    const getVitalStatus = (type, value) => {
        if (value === null || value === undefined) return "No Data";

        switch (type) {
            case 'heart_rate':
                return (value >= 60 && value <= 100) ? "Normal" : "Abnormal";
            case 'spo2':
                return value >= 95 ? "Normal" : "Low - Attention Needed";
            case 'body_temp':
                return (value >= 36 && value <= 37.5) ? "Normal" : value < 36 ? "Low" : "High";
            case 'blood_pressure':
                // Simple check - in real app, you'd parse systolic/diastolic
                return "Check Required";
            default:
                return "Unknown";
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <div className="text-center">
                <Activity className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading health data...</p>
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

    if (!data) return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <div className="text-center">
                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No health data available yet.</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Health Dashboard</h1>
                        <p className="text-gray-600">Real-time monitoring for {user?.patient_name || 'Patient'}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm text-gray-500">Current Time</p>
                            <p className="text-lg font-semibold text-gray-800">{formatTime(currentTime)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                            <span className="text-sm text-gray-600">Live</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Vital Signs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <VitalCard
                    icon={Heart}
                    title="Heart Rate"
                    value={data.heart_rate !== null ? data.heart_rate.toString() : "N/A"}
                    unit="bpm"
                    status={getVitalStatus('heart_rate', data.heart_rate)}
                    color="text-red-500"
                    isAlert={data.heart_rate < 60 || data.heart_rate > 100}
                />

                <VitalCard
                    icon={Activity}
                    title="SpO2"
                    value={data.spo2 !== null ? data.spo2.toString() : "N/A"}
                    unit="%"
                    status={getVitalStatus('spo2', data.spo2)}
                    color="text-blue-500"
                    isAlert={data.spo2 < 95}
                />

                <VitalCard
                    icon={Thermometer}
                    title="Body Temp"
                    value={data.body_temp !== null ? data.body_temp.toFixed(1) : "N/A"}
                    unit="°C"
                    status={getVitalStatus('body_temp', data.body_temp)}
                    color="text-orange-500"
                    isAlert={data.body_temp < 36 || data.body_temp > 37.5}
                />

                <div className={`bg-white rounded-xl p-6 shadow-sm border ${data.fall_detected ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Shield className={`w-5 h-5 ${data.fall_detected ? 'text-red-500' : 'text-green-500'}`} />
                        <span className={`text-sm font-medium ${data.fall_detected ? 'text-red-600' : 'text-gray-600'}`}>
                            Fall Detection
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-2xl sm:text-3xl font-bold ${data.fall_detected ? 'text-red-700' : 'text-gray-800'}`}>
                            {data.fall_detected ? 'ALERT!' : 'Safe'}
                        </span>
                    </div>
                    <div className="mt-2">
                        <span className={`text-sm font-medium ${data.fall_detected ? 'text-red-600' : 'text-green-600'}`}>
                            {data.fall_detected ? 'Immediate Attention Required' : 'No Falls Detected'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Charts and Additional Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Trend Chart */}
                <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-800">Vital Signs Trend</h3>
                        <div className="flex flex-wrap gap-4 mt-2 sm:mt-0">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                <span className="text-sm text-gray-600">Heart Rate</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                <span className="text-sm text-gray-600">SpO2</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                                <span className="text-sm text-gray-600">Body Temp</span>
                            </div>
                        </div>
                    </div>
                    
                    {historicalData.length > 0 ? (
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={historicalData}>
                                    <XAxis 
                                        dataKey="time" 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#6B7280' }}
                                    />
                                    <YAxis 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#6B7280' }}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="heartRate" 
                                        stroke="#EF4444" 
                                        strokeWidth={2}
                                        dot={{ fill: '#EF4444', strokeWidth: 2, r: 4 }}
                                        connectNulls={false}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="spO2" 
                                        stroke="#3B82F6" 
                                        strokeWidth={2}
                                        dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                                        connectNulls={false}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="bodyTemp" 
                                        stroke="#F97316" 
                                        strokeWidth={2}
                                        dot={{ fill: '#F97316', strokeWidth: 2, r: 4 }}
                                        connectNulls={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                            <p className="text-gray-500">Collecting data points...</p>
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="space-y-4">
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Emergency Contact</h3>
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-gray-600">Doctor</p>
                                <p className="font-medium text-gray-800">{user?.doctor_name || 'Not Available'}</p>
                                <p className="text-sm text-blue-600">{user?.doctor_phone || 'No phone'}</p>
                            </div>
                            <ActionButton variant="red" onClick={handleEmergencyCall}>
                                <div className="flex items-center justify-center gap-2">
                                    <Phone className="w-4 h-4" />
                                    Emergency Call
                                </div>
                            </ActionButton>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Patient Info</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Age:</span>
                                <span className="font-medium">{user?.patient_age || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Height:</span>
                                <span className="font-medium">{user?.patient_height || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Weight:</span>
                                <span className="font-medium">{user?.patient_weight || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Device ID:</span>
                                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                    {user?.device_info?.device_id || 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {data.blood_pressure && (
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Blood Pressure</h3>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-gray-800">{data.blood_pressure}</p>
                                <p className="text-sm text-gray-600">mmHg</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Data Source Info */}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-blue-800">
                            Last Updated: {data.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A'}
                        </p>
                        <p className="text-xs text-blue-600">
                            Device: {user?.device_info?.device_id || 'Unknown'} • 
                            Status: {user?.device_info?.is_active ? 'Active' : 'Inactive'}
                        </p>
                    </div>
                    <button 
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                        Refresh Data
                    </button>
                </div>
            </div>
        </div>
    );
}

export default LatestHealthData;