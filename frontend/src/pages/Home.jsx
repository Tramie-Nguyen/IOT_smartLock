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

const Home = () => {
  const navigate = useNavigate();
  const [isLocked, setIsLocked] = useState(true);
  const [isConnected] = useState(true);
  const [network] = useState("HomeNetwork_5G");
  const [lastChanged, setLastChanged] = useState("Today at 2:45 PM");
  const [lastAction, setLastAction] = useState("locked"); // Thêm state cho hành động cuối cùng
  const [recentActivity, setRecentActivity] = useState([]);
  const [socket, setSocket] = useState(null);

  // --- Logic Fetch Dữ liệu từ Firebase ---

  // Fetch initial door status from Firebase (latest log)
  const fetchInitialStatus = useCallback(async () => {
    try {
      const logsRef = collection(db, "logs");
      const q = query(logsRef, orderBy("timestamp", "desc"), limit(1)); // get 1 recent log for state
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const latestLog = snapshot.docs[0].data();

        // --- Chuyển đổi Timestamp thành Date để định dạng ---
        const date = new Date(latestLog.timestamp.seconds * 1000);
        const timeString = date.toLocaleString("vi-VN", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        setLastChanged(timeString);

        // Cập nhật lastAction dựa trên log gần nhất (chỉ lấy 'unlocked' hoặc 'locked')
        const action =
          latestLog.action === "Unlocked" || latestLog.action === "Locked"
            ? latestLog.action.toLowerCase()
            : "locked";
        setLastAction(action);

        // Set door status based on action and time
        if (latestLog.action === "Unlocked") {
          // Check if the unlock event happened within the last 3 seconds
          const now = new Date();
          const logTime = new Date(latestLog.timestamp.seconds * 1000);
          const timeDiffInSeconds = (now - logTime) / 1000;

          if (timeDiffInSeconds < 3) {
            // Recent unlock - show as unlocked and auto-lock after remaining time
            setIsLocked(false);
            const remainingTime = (3 - timeDiffInSeconds) * 1000;
            // Xóa mọi timeout cũ để tránh xung đột
            // Note: Cần lưu trữ timeoutId nếu muốn hủy bỏ nó, nhưng giữ nguyên logic hiện tại
            setTimeout(() => {
              setIsLocked(true);
            }, remainingTime);
          } else {
            // Old unlock - should be locked by now
            setIsLocked(true);
          }
        } else {
          // Locked, Keypad Failed, NFC Failed, Alert, Loitering -> Locked
          setIsLocked(true);
        }
      }
    } catch (error) {
      console.error("Error fetching initial status:", error);
    }
  }, []);

  // Fetch recent activity
  const fetchRecentActivity = useCallback(async () => {
    try {
      const logsRef = collection(db, "logs");
      // Lấy 4 log gần nhất bất kể action là gì để sau đó lọc trên client
      const q = query(logsRef, orderBy("timestamp", "desc"), limit(10));
      const snapshot = await getDocs(q);

      const activities = snapshot.docs
        .map((doc) => {
          const data = doc.data();

          // Lọc ra các log chỉ có action là Unlocked hoặc Locked
          if (data.action !== "Unlocked" && data.action !== "Locked") {
            return null; // Bỏ qua các log Alert/Failed
          }

          // --- Chuyển đổi Timestamp thành Date để định dạng ---
          const date = new Date(data.timestamp.seconds * 1000);
          const timeString = date.toLocaleString("vi-VN", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          let actionText = "";
          let type = "";

          if (data.action === "Unlocked") {
            actionText = `Door Unlocked (${data.method || "App"})`;
            type = "unlock";
          } else if (data.action === "Locked") {
            // Logic tạm thời: log Locked trong DB là từ auto-lock hoặc app manual lock
            actionText = `Door Locked (${data.method || "Auto-lock"})`;
            type = "lock";
          }

          return {
            action: actionText,
            time: timeString,
            type: type,
          };
        })
        .filter(Boolean) // Lọc bỏ các giá trị 'null'
        .slice(0, 4); // Chỉ giữ lại 4 hoạt động gần nhất sau khi lọc

      setRecentActivity(activities);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
    }
  }, []);

  // --- Logic Socket.IO và Control ---

  // Handle door unlock with auto-lock after 3 seconds
  const handleDoorUnlock = (data) => {
    setIsLocked(false);
    setLastAction("unlocked"); // Cập nhật lastAction

    // data.timestamp từ backend đã là chuỗi localTime, không cần chuyển đổi
    setLastChanged(data.timestamp);

    // Refresh recent activity
    fetchRecentActivity();

    // Auto-lock after 3 seconds
    setTimeout(() => {
      setIsLocked(true);
    }, 3000);
  };

  // Connect to Socket.IO and listen for real-time updates
  useEffect(() => {
    fetchInitialStatus();
    fetchRecentActivity();

    // Connect to Socket.IO server
    const newSocket = io("http://localhost:3000"); // Adjust to your backend URL
    setSocket(newSocket);

    // Listen for MQTT events
    newSocket.on("051_428_475/esp/nfc-success", (data) => {
      console.log("NFC Success:", data);
      handleDoorUnlock(data);
    });

    newSocket.on("051_428_475/esp/keypad-success", (data) => {
      console.log("Keypad Success:", data);
      handleDoorUnlock(data);
    });

    // Các sự kiện Alert/Failed vẫn cần refresh activity để đảm bảo FE có thể thấy log Alert (nếu có logic hiển thị khác)
    newSocket.on("051_428_475/esp/nfc-failed", () => {
      fetchRecentActivity();
    });

    newSocket.on("051_428_475/esp/keypad-failed", () => {
      fetchRecentActivity();
    });

    newSocket.on("051_428_475/esp/loitering-detected", () => {
      fetchRecentActivity();
      // Show alert notification
    });

    return () => {
      newSocket.disconnect();
    };
  }, [fetchInitialStatus, fetchRecentActivity]);

  const handleLogout = () => {
    if (socket) {
      socket.disconnect();
    }
    navigate("/login");
  };

  const toggleLock = () => {
    // Manual lock/unlock from app
    if (socket) {
      const topic = isLocked
        ? "051_428_475/app/unlock"
        : "051_428_475/app/lock";
      // Gửi lệnh lên backend
      socket.emit("publish", { topic, message: "toggle" });
    }

    // Client-side state update for better UX
    if (!isLocked) {
      // Locking manually
      setIsLocked(true);
      setLastAction("locked"); // Cập nhật lastAction
      const now = new Date().toLocaleString("vi-VN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      setLastChanged(now);
      // Giả định backend sẽ log hành động này, sau đó fetchRecentActivity sẽ được gọi
      fetchRecentActivity();
    } else {
      // Unlocking manually
      setIsLocked(false);
      setLastAction("unlocked"); // Cập nhật lastAction
      const now = new Date().toLocaleString("vi-VN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      setLastChanged(now);
      // Giả định backend sẽ log hành động này, sau đó fetchRecentActivity sẽ được gọi
      fetchRecentActivity();

      // Auto-lock after 3 seconds
      setTimeout(() => {
        setIsLocked(true);
      }, 3000);
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
              <h1 className="text-xl font-bold text-gray-900">
                Smart Door Lock
              </h1>
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
                  className={`w-40 h-40 rounded-full flex items-center justify-center transition-all transform hover:scale-105 shadow-2xl ${
                    isLocked
                      ? "bg-white/20 backdrop-blur-sm hover:bg-white/30"
                      : "bg-yellow-400 hover:bg-yellow-500"
                  }`}
                >
                  {isLocked ? (
                    <Lock className="w-20 h-20 text-white" />
                  ) : (
                    <Unlock className="w-20 h-20 text-gray-800" />
                  )}
                </button>

                <div className="text-center">
                  <p className="text-2xl font-semibold">
                    {isLocked ? "Door Locked" : "Door Unlocked"}
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
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        item.type === "lock" ? "bg-green-100" : "bg-yellow-100"
                      }`}
                    >
                      {item.type === "lock" ? (
                        <Lock className="w-5 h-5 text-green-600" />
                      ) : (
                        <Unlock className="w-5 h-5 text-yellow-600" />
                      )}
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
                No recent activity (Only shows Lock/Unlock actions)
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
