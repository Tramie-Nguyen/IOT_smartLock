import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Unlock, Calendar, ArrowLeft, Home as HomeIcon } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const History = () => {
  const navigate = useNavigate();
  
  const dailyFrequency = [
    { date: 'Nov 12', locks: 4, unlocks: 4 },
    { date: 'Nov 13', locks: 3, unlocks: 3 },
    { date: 'Nov 14', locks: 5, unlocks: 5 },
    { date: 'Nov 15', locks: 6, unlocks: 6 },
    { date: 'Nov 16', locks: 4, unlocks: 4 },
    { date: 'Nov 17', locks: 3, unlocks: 3 },
  ];

  const unlockingMethods = [
    { name: 'Password', value: 65 },
    { name: 'NFC Card', value: 35 },
  ];

  const COLORS = ['#14B8A6', '#7C5DFF'];

  const historyLogs = [
    { action: 'Locked', timestamp: 'Today at 2:45 PM', user: 'You' },
    { action: 'Unlocked', timestamp: 'Today at 1:30 PM', user: 'You' },
    { action: 'Locked', timestamp: 'Today at 1:25 PM', user: 'You' },
    { action: 'Unlocked', timestamp: 'Yesterday at 6:20 PM', user: 'You' },
    { action: 'Locked', timestamp: 'Yesterday at 10:15 AM', user: 'You' },
    { action: 'Unlocked', timestamp: 'Nov 15 at 7:30 PM', user: 'Family' },
    { action: 'Locked', timestamp: 'Nov 15 at 7:25 PM', user: 'Family' },
    { action: 'Unlocked', timestamp: 'Nov 14 at 5:45 PM', user: 'You' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left Side */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/home')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">Lock History</h1>
              </div>
            </div>
            {/* Right Side */}
            <button
              onClick={() => navigate('/home')}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <HomeIcon className="w-5 h-5" />
              <span className="font-medium">Home</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"> {/* thường thì 1 chart, >= lg thì 2 chart */}
          {/* Bar Chart: Daily Lock/Unlock Frequency */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Activity</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={dailyFrequency}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#6B7280' }}
                  tickLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis 
                  tick={{ fill: '#6B7280' }}
                  tickLine={{ stroke: '#E5E7EB' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                <Bar dataKey="locks" fill="#4F46E5" name="Locked" radius={[8, 8, 0, 0]} />
                <Bar dataKey="unlocks" fill="#14B8A6" name="Unlocked" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart: Unlocking Methods */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Unlock Methods</h3>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={unlockingMethods}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {unlockingMethods.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* History Logs */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Lock Activity Log</h2>
          </div>

          <div className="space-y-2">
            {historyLogs.map((log, idx) => (
              <div 
                key={idx} 
                className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-0"
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  log.action === 'Locked'
                    ? 'bg-indigo-100'
                    : 'bg-teal-100'
                }`}>
                  {log.action === 'Locked' ? (
                    <Lock className="w-6 h-6 text-indigo-600" />
                  ) : (
                    <Unlock className="w-6 h-6 text-teal-600" />
                  )}
                </div>
                
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{log.action}</p>
                </div>
                
                <div className="text-right">
                  <p className="text-sm text-gray-500">{log.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default History;
