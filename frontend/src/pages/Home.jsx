import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wifi,
  WifiOff,
  Lock,
  Unlock,
  History,
  Bell,
  Settings,
  LogOut,
} from "lucide-react";
import { io } from "socket.io-client";
import { db } from "../firebase-config";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import authService from "../services/authService";

const Home = () => {
  const navigate = useNavigate();
  const [isLocked, setIsLocked] = useState(true);
  const [isConnected] = useState(true);
  const [network] = useState("HomeNetwork_5G");
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastChanged, setLastChanged] = useState("--");
  const [lastAction, setLastAction] = useState("locked");
  const [recentActivity, setRecentActivity] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Get current user info
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);

    // Initialize WebSocket connection
    const socket = io("http://localhost:3000");

    // Listen for door status updates
    socket.on("door_status_update", (data) => {
      console.log("Door status update:", data);
      setIsLocked(data.isLocked || data.status === "LOCKED");
      setLastChanged(new Date().toLocaleString());
    });

    // Listen for door action completion
    socket.on("door_action_complete", (data) => {
      console.log("Door action complete:", data);
      setIsLoading(false);

      if (data.success) {
        setIsLocked(data.action === "LOCK");
        const newActivity = {
          action: data.action === "LOCK" ? "Door Locked" : "Door Unlocked",
          time: new Date().toLocaleString(),
          type: data.action === "LOCK" ? "lock" : "unlock",
        };
        setRecentActivity((prev) => [newActivity, ...prev.slice(0, 3)]);
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
      await authService.api.get("/door-status");
    } catch (error) {
      console.error("Error getting door status:", error);
    }
  };

  // Fetch last changed time from latest log
  const fetchLastChanged = useCallback(async () => {
    try {
      const logsRef = collection(db, "logs");
      const q = query(logsRef, orderBy("timestamp", "desc"), limit(1));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const latestLog = snapshot.docs[0].data();
        const date = new Date(latestLog.timestamp.seconds * 1000);
        const timeString = date.toLocaleString("vi-VN", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        setLastChanged(timeString);

        // Cập nhật lastAction dựa trên log gần nhất
        const action =
          latestLog.action === "Unlocked" || latestLog.action === "Locked"
            ? latestLog.action.toLowerCase()
            : "locked";
        setLastAction(action);
      }
    } catch (error) {
      console.error("Error fetching last changed:", error);
    }
  }, []);

  // Fetch recent activity - CHỈ lấy Unlocked logs từ NFC và Keypad
  const fetchRecentActivity = useCallback(async () => {
    console.log("Fetching recent activity...");
    try {
      const logsRef = collection(db, "logs");
      // Lấy nhiều log hơn để đảm bảo có đủ sau khi lọc
      const q = query(logsRef, orderBy("timestamp", "desc"), limit(20));
      const snapshot = await getDocs(q);

      console.log("Total docs fetched:", snapshot.docs.length);

      // Debug: In ra toàn bộ dữ liệu thô
      snapshot.docs.forEach((doc, index) => {
        console.log(`Log ${index}:`, doc.data());
      });

      const activities = snapshot.docs
        .map((doc) => {
          const data = doc.data();

          // Kiểm tra có đủ field không
          if (!data.action || !data.timestamp) {
            console.warn("Missing action or timestamp:", data);
            return null;
          }

          // CHỈ LẤY Unlocked logs
          if (data.action !== "Unlocked") {
            return null;
          }

          // Chuyển đổi timestamp
          let date;
          try {
            date = new Date(data.timestamp.seconds * 1000);
          } catch (e) {
            console.error("Error converting timestamp:", data, e);
            return null;
          }

          const timeString = date.toLocaleString("vi-VN", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          // Format action text
          const actionText = `Door Unlocked (${data.method || "Unknown"})`;

          return {
            action: actionText,
            time: timeString,
            type: "unlock",
          };
        })
        .filter(Boolean) // Lọc bỏ null
        .slice(0, 4); // Chỉ lấy 4 cái đầu

      console.log("Final activities:", activities);
      setRecentActivity(activities);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
    }
  }, []);

  // Handle door unlock with auto-lock after 3 seconds
  const handleDoorUnlock = (data) => {
    setIsLocked(false);
    setLastAction("unlocked");
    setLastChanged(data.timestamp);

    // Refresh data
    fetchLastChanged();
    fetchRecentActivity();

    // Auto-lock after 3 seconds
    setTimeout(() => {
      setIsLocked(true);
    }, 3000);
  };

  // Connect to Socket.IO and listen for real-time updates
  useEffect(() => {
    fetchLastChanged();
    fetchRecentActivity();

    const newSocket = io("http://localhost:3000");
    setSocket(newSocket);

    newSocket.on("051_428_475/esp/nfc-success", (data) => {
      console.log("NFC Success:", data);
      handleDoorUnlock(data);
    });

    newSocket.on("051_428_475/esp/keypad-success", (data) => {
      console.log("Keypad Success:", data);
      handleDoorUnlock(data);
    });

    newSocket.on("051_428_475/esp/nfc-failed", (data) => {
      console.log("NFC Failed:", data);
      fetchLastChanged();
      fetchRecentActivity();
    });

    newSocket.on("051_428_475/esp/keypad-failed", (data) => {
      console.log("Keypad Failed:", data);
      fetchLastChanged();
      fetchRecentActivity();
    });

    newSocket.on("051_428_475/esp/loitering-detected", (data) => {
      console.log("Loitering Detected:", data);
      fetchLastChanged();
      fetchRecentActivity();
    });

    return () => {
      newSocket.disconnect();
    };
  }, [fetchLastChanged, fetchRecentActivity]);

  const handleLogout = () => {
    if (socket) {
      socket.disconnect();
    }
    navigate("/login");
    authService.logout();
    navigate("/login");
  };

  const toggleLock = async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);

      if (isLocked) {
        // Unlock the door
        const response = await authService.api.post("/unlock");
        console.log("Unlock response:", response.data);
      } else {
        // Lock the door
        const response = await authService.api.post("/lock");
        console.log("Lock response:", response.data);
      }
    } catch (error) {
      console.error("Error toggling lock:", error);
      setIsLoading(false);

      // Show error message or handle error
      if (error.response?.status === 401) {
        navigate("/login");
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
                <h1 className="text-xl font-bold text-gray-900">
                  Smart Door Lock
                </h1>
                {user && (
                  <p className="text-sm text-gray-500">
                    Welcome back, {user.fullName}
                  </p>
                )}
              </div>
            </div>

            <nav className="flex items-center gap-6">
              <button
                onClick={() => navigate("/notifications")}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <Bell className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate("/settings")}
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
                      ? "bg-gray-400 cursor-not-allowed"
                      : isLocked
                      ? "bg-white/20 backdrop-blur-sm hover:bg-white/30"
                      : "bg-yellow-400 hover:bg-yellow-500"
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
                    {isLoading
                      ? "Processing..."
                      : isLocked
                      ? "Door Locked"
                      : "Door Unlocked"}
                  </p>
                  <p className="text-sm text-white/70 mt-2">
                    {isLocked
                      ? "Click to unlock the door"
                      : "Auto-locking in 3 seconds..."}
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
                  <p className="text-sm font-medium text-gray-500">
                    Last Changed
                  </p>
                  <p className="text-lg font-bold text-gray-900 mt-2">
                    {lastChanged}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Door was {lastAction}
                  </p>
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
                  <p className="text-sm font-medium text-gray-500">
                    Wi-Fi Status
                  </p>
                  <p className="text-base font-semibold text-gray-900 mt-2">
                    {isConnected ? network : "Not Connected"}
                  </p>
                </div>
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    isConnected ? "bg-blue-100" : "bg-red-100"
                  }`}
                >
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
              <h3 className="text-sm font-medium text-gray-500 mb-4">
                Quick Actions
              </h3>
              <div className="space-y-3">
                <button
                  onClick={() => navigate("/history")}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <History className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-900">
                    View History
                  </span>
                </button>
                <button
                  onClick={() => navigate("/notifications")}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-900">
                    Notifications
                  </span>
                </button>
                <button
                  onClick={() => navigate("/settings")}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <Settings className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-900">
                    Settings
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Recent Activity
            </h3>
            <button
              onClick={() => navigate("/history")}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {recentActivity.length > 0 ? (
              recentActivity.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-yellow-100">
                      <Unlock className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-gray-900 font-medium">{item.action}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">{item.time}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-4">
                No recent unlock activity
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
