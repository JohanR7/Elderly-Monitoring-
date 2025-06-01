import React, { useState, useEffect } from 'react';
import { Heart, Activity, Thermometer, Shield, Phone, MapPin, User, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';

function LatestHealthData() {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [historicalData, setHistoricalData] = useState([]);

    // Mock API base URL - replace with your actual backend URL
    const API_BASE_URL = 'http://localhost:8000/api'; // Adjust this to your backend URL

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
                // ✅ Actual API call
                const response = await fetch(`${API_BASE_URL}/health-data/latest/`);

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                const responseData = await response.json();

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

        fetchData();
        const intervalId = setInterval(fetchData, 30000);
        return () => clearInterval(intervalId);
    }, []);


    const handleEmergencyCall = () => {
        alert('Emergency call initiated to Dr. Sarah Wilson');
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
        <div className="p-10">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <Activity className="w-8 h-8 text-blue-600" />
                        <h1 className="text-3xl font-bold text-gray-800">Elderly Monitoring System</h1>
                    </div>
                    <p className="text-gray-600">Real-time health monitoring dashboard</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Left Column - Patient Info */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Patient Information */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3 mb-4">
                                <User className="w-5 h-5 text-blue-600" />
                                <span className="font-medium text-gray-700">Patient Information</span>
                            </div>
                            <div className="space-y-3">
                                <h2 className="text-xl font-bold text-gray-800">Margaret Johnson</h2>
                                <p className="text-gray-600">Age: 78 years</p>
                                <div className="flex items-start gap-2 mt-4">
                                    <MapPin className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                                    <div className="text-sm text-gray-600">
                                        <p className="font-medium">Address</p>
                                        <p>123 Oak Street, Springfield, IL 62701</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Emergency Contact */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3 mb-4">
                                <Phone className="w-5 h-5 text-green-600" />
                                <span className="font-medium text-gray-700">Emergency Contact</span>
                            </div>
                            <div className="space-y-3">
                                <h3 className="font-semibold text-gray-800">Dr. Sarah Wilson</h3>
                                <p className="text-blue-600 font-medium">+1 (555) 123-4567</p>
                                <ActionButton variant="red" onClick={handleEmergencyCall}>
                                    <div className="flex items-center justify-center gap-2">
                                        <Phone className="w-4 h-4" />
                                        Emergency Call
                                    </div>
                                </ActionButton>
                            </div>
                        </div>

                        {/* Medical Conditions */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3 mb-4">
                                <Heart className="w-5 h-5 text-red-500" />
                                <span className="font-medium text-gray-700">Medical Conditions</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">Hypertension</span>
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">Diabetes Type 2</span>
                                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">Osteoporosis</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Monitoring Data */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Vital Signs Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                                    <span className={`text-3xl font-bold ${data.fall_detected ? 'text-red-700' : 'text-gray-800'}`}>
                                        {data.fall_detected ? 'ALERT!' : 'Safe'}
                                    </span>
                                </div>
                                <div className="mt-2">
                                    <span className={`text-sm font-medium ${data.fall_detected ? 'text-red-600' : 'text-green-600'}`}>
                                        {data.fall_detected ? 'Fall detected — Attention required!' : 'No Falls'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Blood Pressure Card */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <VitalCard
                                icon={Heart}
                                title="Blood Pressure"
                                value={data.blood_pressure || "N/A"}
                                unit="mmHg"
                                status={getVitalStatus('blood_pressure', data.blood_pressure)}
                                color="text-purple-500"
                            />

                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <Activity className="w-5 h-5 text-gray-600" />
                                    <span className="text-gray-600 text-sm font-medium">Last Updated</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-gray-800">
                                        {new Date(data.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                                <div className="mt-2">
                                    <span className="text-green-600 text-sm font-medium">
                                        {new Date(data.timestamp).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Vital Signs Chart */}
                        {historicalData.length > 0 && (
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                                <h3 className="font-medium text-gray-700 mb-6">Vital Signs </h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={historicalData}>
                                            <XAxis
                                                dataKey="time"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 12, fill: '#9CA3AF' }}
                                            />
                                            <YAxis
                                                domain={[0, 110]}
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 12, fill: '#9CA3AF' }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="spO2"
                                                stroke="#3B82F6"
                                                strokeWidth={2}
                                                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                                                name="SpO2"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="heartRate"
                                                stroke="#EF4444"
                                                strokeWidth={2}
                                                dot={{ fill: '#EF4444', strokeWidth: 2, r: 4 }}
                                                name="Heart Rate"
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex items-center justify-center gap-6 mt-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                        <span className="text-sm text-gray-600">SpO2 (%)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                        <span className="text-sm text-gray-600">Heart Rate (bpm)</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LatestHealthData;