import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Lock,
  Unlock,
  Calendar,
  ArrowLeft,
  Home as HomeIcon,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { db } from "../../src/firebase-config.js";
import { collection, getDocs } from "firebase/firestore";

const History = () => {
  const navigate = useNavigate();

  // State quản lý dữ liệu động
  const [dailyActivity, setDailyActivity] = useState([]);
  const [unlockMethods, setUnlockMethods] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const COLORS = ["#14B8A6", "#7C5DFF", "#F59E0B", "#EF4444"];

  // Hàm xử lý logs
  const processLogs = (logs) => {
    const dailyMap = {}; // Số lần unlock theo ngày

    // Xử lý unlock methods (pie chart)
    const methodMap = {
      Keypad: 0,
      NFC: 0,
    };
    let totalUnlocks = 0;

    // Xử lý Activity Log (Danh sách)
    const processedActivityLogs = [];

    // Sắp xếp logs theo thời gian giảm dần (mới nhất trước)
    logs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);

    logs.forEach((log) => {
      const date = new Date(log.timestamp.seconds * 1000);
      const dateKey = date.toLocaleDateString("vi-VN", {
        month: "short",
        day: "numeric",
      });
      const timeString = date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const timestampDisplay = `${dateKey} at ${timeString}`;

      // Chỉ xử lý Unlocked actions
      if (log.action === "Unlocked") {
        // Daily Activity
        if (!dailyMap[dateKey]) {
          dailyMap[dateKey] = { date: dateKey, unlocks: 0 };
        }
        dailyMap[dateKey].unlocks += 1;

        // Tăng tổng số lần mở khóa
        totalUnlocks++;

        // Tăng số lần mở khóa theo phương thức (chỉ Keypad và NFC)
        if (log.method === "Keypad" || log.method === "NFC") {
          methodMap[log.method]++;
        }

        // Activity Log List - chỉ hiển thị Unlocked
        const logEntry = {
          action: log.action,
          method: log.method, // Keypad, NFC, hoặc App
          timestamp: timestampDisplay,
        };
        processedActivityLogs.push(logEntry);
      }
    });

    // Finalize Daily Activity - sắp xếp theo ngày
    const finalDailyActivity = Object.values(dailyMap).sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA - dateB;
    });

    // Finalize Unlock Methods (Pie Chart) - chỉ Keypad và NFC
    const finalUnlockMethods = Object.keys(methodMap)
      .map((key) => ({
        name: key,
        value:
          totalUnlocks > 0
            ? Math.round((methodMap[key] / totalUnlocks) * 100)
            : 0,
      }))
      .filter((entry) => entry.value > 0); // Loại bỏ entries 0%

    setDailyActivity(finalDailyActivity);
    setUnlockMethods(finalUnlockMethods);
    setActivityLogs(processedActivityLogs);
    setLoading(false);
  };

  // Hàm fetch dữ liệu từ Firebase
  const fetchHistoryData = useCallback(async () => {
    setLoading(true);
    try {
      const logsRef = collection(db, "logs");
      const snapshot = await getDocs(logsRef);

      const logs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp,
      }));

      processLogs(logs);
    } catch (error) {
      console.error("Error fetching history data: ", error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistoryData();
  }, [fetchHistoryData]);

  // Helper Function để lấy Icon và Màu sắc
  const getLogStyle = (method) => {
    return {
      Icon: Unlock,
      bg: "bg-teal-100",
      text: "text-teal-600",
      label: `Unlocked (${method})`,
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl font-medium text-gray-600">Loading history...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/home")}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">
                  Lock History
                </h1>
              </div>
            </div>
            <button
              onClick={() => navigate("/home")}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Bar Chart: Daily Unlock Activity */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Daily Unlock Activity
            </h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={dailyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#6B7280" }}
                  tickLine={{ stroke: "#E5E7EB" }}
                />
                <YAxis
                  tick={{ fill: "#6B7280" }}
                  tickLine={{ stroke: "#E5E7EB" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                />
                <Legend />
                <Bar
                  dataKey="unlocks"
                  fill="#14B8A6"
                  name="Unlocked"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart: Unlocking Methods */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Unlock Methods
            </h3>
            {unlockMethods.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={unlockMethods}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, value }) => `${name}: ${value}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {unlockMethods.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #E5E7EB",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-80">
                <p className="text-gray-500">No unlock data available</p>
              </div>
            )}
          </div>
        </div>

        {/* History Logs */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Lock Activity Log
            </h2>
          </div>

          <div className="space-y-2">
            {activityLogs.length > 0 ? (
              activityLogs.map((log, idx) => {
                const style = getLogStyle(log.method);
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-0"
                  >
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center ${style.bg}`}
                    >
                      <style.Icon className={`w-6 h-6 ${style.text}`} />
                    </div>

                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {style.label}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-gray-500">{log.timestamp}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-gray-500 py-8">
                No activity logs found
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default History;
