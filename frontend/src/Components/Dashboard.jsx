import React, { useState, useEffect } from 'react';
import { LogOut, Menu, X, User, Activity, FileText, Settings, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from './AuthContext';
import LatestHealthData from './LatestHealthData';
import PatientContactInfo from './PatientContactInfo';
import HealthReportGenerator from './HealthReportGenerator';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState({ is_active: true, status: 'active' });
  const { user, logout, token } = useAuth();

  // Check device status every 30 seconds
  useEffect(() => {
    const checkDeviceStatus = async () => {
      try {
        const response = await fetch('/api/device/status/', {
          headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setDeviceStatus(data);
        }
      } catch (error) {
        console.error('Error checking device status:', error);
        setDeviceStatus({ is_active: false, status: 'inactive' });
      }
    };

    if (token) {
      checkDeviceStatus();
      const interval = setInterval(checkDeviceStatus, 30000); // Check every 30 seconds
      return () => clearInterval(interval);
    }
  }, [token]);

  const handleLogout = async () => {
    await logout();
  };

  const navigation = [
    { id: 'dashboard', name: 'Dashboard', icon: Activity },
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'reports', name: 'Reports', icon: FileText },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <LatestHealthData />
          </div>
        );
      case 'profile':
        return <PatientContactInfo />;
      case 'reports':
        return <HealthReportGenerator />;
      default:
        return (
          <div className="space-y-6">
            <LatestHealthData />
          </div>
        );
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-gray-600 opacity-75"></div>
        </div>
      )}

      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center">
            <Activity className="w-8 h-8 text-blue-600" />
            <span className="ml-2 text-xl font-bold text-gray-800">HealthMonitor</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 px-4 py-6 overflow-y-auto">
            <div className="mb-8">
              <div className="flex items-center px-4 py-2 bg-blue-50 rounded-lg">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-800">
                    {user?.patient_name || 'Patient'}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-600">
                      Device: {user?.device_info?.device_id || 'N/A'}
                    </p>
                    <div className="flex items-center">
                      {deviceStatus.is_active ? (
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      ) : (
                        <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <nav className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`${
                      activeTab === item.id
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'text-gray-600 hover:bg-gray-50 border-transparent'
                    } group flex items-center px-4 py-2 text-sm font-medium rounded-lg border w-full transition-colors`}
                  >
                    <Icon
                      className={`${
                        activeTab === item.id ? 'text-blue-500' : 'text-gray-400'
                      } mr-3 h-5 w-5`}
                    />
                    {item.name}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Logout button - Fixed at bottom */}
          <div className="px-4 py-4 border-t border-gray-200 flex-shrink-0">
            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg w-full transition-colors"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Top navigation - Fixed */}
        <div className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
                >
                  <Menu className="h-6 w-6" />
                </button>
                <h1 className="ml-4 lg:ml-0 text-2xl font-bold text-gray-800 capitalize">
                  {activeTab}
                </h1>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="hidden sm:flex items-center text-sm">
                  {deviceStatus.is_active ? (
                    <div className="flex items-center text-green-600">
                      <Wifi className="w-4 h-4 mr-2" />
                      <span>Device Active</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-red-600">
                      <WifiOff className="w-4 h-4 mr-2" />
                      <span>Device Inactive</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="lg:hidden flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Page content - Scrollable */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {renderContent()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
