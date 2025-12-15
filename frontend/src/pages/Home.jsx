import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wifi, WifiOff, Lock, Unlock, History, Bell, Settings, LogOut } from 'lucide-react';
import authService from '../services/authService';
import { io } from 'socket.io-client';

const Home = () => {
  const navigate = useNavigate();
  const [isLocked, setIsLocked] = useState(true);
  const [isConnected] = useState(true);
  const [network] = useState('HomeNetwork_5G');
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastChanged, setLastChanged] = useState('Today at 2:45 PM');
  const [recentActivity, setRecentActivity] = useState([
    { action: 'Door Locked', time: 'Today at 2:45 PM', type: 'lock' },
    { action: 'Door Unlocked', time: 'Today at 1:30 PM', type: 'unlock' },
    { action: 'Door Locked', time: 'Today at 1:25 PM', type: 'lock' },
    { action: 'Door Unlocked', time: 'Today at 9:15 AM', type: 'unlock' },
  ]);

  useEffect(() => {
    // Get current user info
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);

    // Initialize WebSocket connection
    const socket = io('http://localhost:3000');

    // Listen for door status updates
    socket.on('door_status_update', (data) => {
      console.log('Door status update:', data);
      setIsLocked(data.isLocked || data.status === 'LOCKED');
      setLastChanged(new Date().toLocaleString());
    });

    // Listen for door action completion
    socket.on('door_action_complete', (data) => {
      console.log('Door action complete:', data);
      setIsLoading(false);
      
      if (data.success) {
        setIsLocked(data.action === 'LOCK');
        const newActivity = {
          action: data.action === 'LOCK' ? 'Door Locked' : 'Door Unlocked',
          time: new Date().toLocaleString(),
          type: data.action === 'LOCK' ? 'lock' : 'unlock'
        };
        setRecentActivity(prev => [newActivity, ...prev.slice(0, 3)]);
        setLastChanged(newActivity.time);
      }
    });

    // Get initial door status
    getDoorStatus();

    return () => {
      socket.disconnect();
    };
  }, []);

  const getDoorStatus = async () => {
    try {
      await authService.api.get('/door-status');
    } catch (error) {
      console.error('Error getting door status:', error);
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const toggleLock = async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      
      if (isLocked) {
        // Unlock the door
        const response = await authService.api.post('/unlock-door');
        console.log('Unlock response:', response.data);
      } else {
        // Lock the door
        const response = await authService.api.post('/lock-door');
        console.log('Lock response:', response.data);
      }
    } catch (error) {
      console.error('Error toggling lock:', error);
      setIsLoading(false);
      
      // Show error message or handle error
      if (error.response?.status === 401) {
        navigate('/login');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Smart Door Lock</h1>
                {user && (
                  <p className="text-sm text-gray-500">Welcome back, {user.fullName}</p>
                )}
              </div>
            </div>
            
            <nav className="flex items-center gap-6">
              <button 
                onClick={() => navigate('/notifications')}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <Bell className="w-5 h-5" />
              </button>
              <button 
                onClick={() => navigate('/settings')}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button 
                onClick={handleLogout}
                className="text-gray-600 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Lock Control */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl shadow-xl p-8 text-white">
              <div className="flex flex-col items-center justify-center gap-8 py-12">
                <h2 className="text-3xl font-bold text-center">Front Door</h2>
                
                <button
                  onClick={toggleLock}
                  disabled={isLoading}
                  className={`w-40 h-40 rounded-full flex items-center justify-center transition-all transform hover:scale-105 shadow-2xl ${
                    isLoading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : isLocked
                      ? 'bg-white/20 backdrop-blur-sm hover:bg-white/30'
                      : 'bg-yellow-400 hover:bg-yellow-500'
                  }`}
                >
                  {isLoading ? (
                    <div className="w-20 h-20 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : isLocked ? (
                    <Lock className="w-20 h-20 text-white" />
                  ) : (
                    <Unlock className="w-20 h-20 text-gray-800" />
                  )}
                </button>

                <div className="text-center">
                  <p className="text-2xl font-semibold">
                    {isLoading ? 'Processing...' : isLocked ? 'Door Locked' : 'Door Unlocked'}
                  </p>
                  <p className="text-sm text-white/70 mt-2">
                    {isLoading ? 'Please wait...' : `Click to ${isLocked ? 'unlock' : 'lock'} the door`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Status Cards */}
          <div className="space-y-6">
            {/* Last Changed Status */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500">Last Changed</p>
                  <p className="text-lg font-bold text-gray-900 mt-2">{lastChanged}</p>
                  <p className="text-sm text-gray-500 mt-1">Door was {isLocked ? 'locked' : 'unlocked'}</p>
                </div>
                <div className="w-14 h-14 rounded-xl bg-yellow-100 flex items-center justify-center">
                  <History className="w-8 h-8 text-yellow-600" />
                </div>
              </div>
            </div>

            {/* Wi-Fi Status */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Wi-Fi Status</p>
                  <p className="text-base font-semibold text-gray-900 mt-2">
                    {isConnected ? network : 'Not Connected'}
                  </p>
                </div>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                  isConnected ? 'bg-blue-100' : 'bg-red-100'
                }`}>
                  {isConnected ? (
                    <Wifi className="w-8 h-8 text-blue-600" />
                  ) : (
                    <WifiOff className="w-8 h-8 text-red-600" />
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button 
                  onClick={() => navigate('/history')}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <History className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-900">View History</span>
                </button>
                <button 
                  onClick={() => navigate('/notifications')}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-900">Notifications</span>
                </button>
                <button 
                  onClick={() => navigate('/settings')}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <Settings className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-900">Settings</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <button 
              onClick={() => navigate('/history')}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {recentActivity.map((item, idx) => (
              <div 
                key={idx} 
                className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
              >
                {/* icon + action */}
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    item.type === 'lock' ? 'bg-green-100' : 'bg-yellow-100'
                  }`}>
                    {item.type === 'lock' ? (
                      <Lock className="w-5 h-5 text-green-600" />
                    ) : (
                      <Unlock className="w-5 h-5 text-yellow-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-gray-900 font-medium">{item.action}</p>
                  </div>
                </div>
                {/* time */}
                <p className="text-sm text-gray-500">{item.time}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
