import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Bell,
  Battery,
  Lock, // Giữ lại Lock icon nếu muốn thêm thông báo Door Lock (Locked/Unlocked)
  ArrowLeft,
  Home as HomeIcon,
  X,
} from "lucide-react";

// --- Imports từ Firebase ---
import { db } from "../firebase-config";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";

// Không cần import io từ Socket.IO client vì không dùng Real-time
// import io from "socket.io-client";

const Notifications = () => {
  const navigate = useNavigate();
  // Khởi tạo notifications rỗng, sẽ được load từ Firebase
  const [notifications, setNotifications] = useState([]);

  // Hàm chuyển đổi log Firebase thành đối tượng Notification chuẩn
  const mapLogToNotification = (log) => {
    const data = log.data();

    // Kiểm tra và xử lý trường timestamp (giả sử là Firebase Timestamp)
    if (!data.timestamp || typeof data.timestamp.seconds === "undefined") {
      console.warn("Log missing valid timestamp:", data);
      return null;
    }

    const date = new Date(data.timestamp.seconds * 1000);
    const timeString = date.toLocaleString("vi-VN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    let type, title, message, icon, severity;

    // Dựa vào topic hoặc action để phân loại thông báo
    switch (data.topic) {
      case "051_428_475/esp/nfc-failed":
        type = "invalid_attempt";
        title = "Failed Login Attempt (NFC)";
        message = data.message || "Wrong key/password entered.";
        icon = AlertCircle;
        severity = "warning";
        break;
      case "051_428_475/esp/keypad-failed":
        type = "invalid_attempt";
        title = "Failed Login Attempt (Keypad)";
        message = data.message || "Wrong key/password entered.";
        icon = AlertCircle;
        severity = "warning";
        break;
      case "051_428_475/esp/loitering-detected":
        type = "loitering";
        title = "Loitering Detected";
        message =
          data.message || "A person was detected near the door for too long.";
        icon = AlertCircle;
        severity = "alert";
        break;
      case "051_428_475/esp/doorbell-pressed":
        type = "doorbell";
        title = "Doorbell Pressed";
        message = data.message || "Someone pressed your doorbell.";
        icon = Bell;
        severity = "info";
        break;
      case "051_428_475/esp/battery-low":
        type = "low_battery";
        title = "Low Battery Warning";
        message =
          data.message ||
          "Lock battery is below 20%. Please replace or recharge.";
        icon = Battery;
        severity = "alert";
        break;
      default:
        // Bỏ qua các log khác (như Unlocked/Locked thông thường)
        return null;
    }

    return {
      id: log.id, // Sử dụng ID document của Firestore
      type,
      title,
      message,
      time: timeString,
      icon,
      severity,
    };
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const logsRef = collection(db, "logs");
      // Lấy 20 log gần nhất
      const q = query(logsRef, orderBy("timestamp", "desc"), limit(20));
      const snapshot = await getDocs(q);

      const fetchedNotifications = snapshot.docs
        .map(mapLogToNotification)
        .filter(Boolean); // Lọc bỏ các giá trị null (các log không phải thông báo)

      setNotifications(fetchedNotifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, []);

  useEffect(() => {
    // Chỉ gọi hàm fetch một lần khi component mount
    fetchNotifications();

    // Nếu muốn tự động tải lại sau một khoảng thời gian (VD: 60s)
    // const intervalId = setInterval(fetchNotifications, 60000);
    // return () => clearInterval(intervalId);
  }, [fetchNotifications]);

  // --- Các hàm UI ---
  const getSeverityColor = (severity) => {
    switch (severity) {
      case "warning":
        return "bg-yellow-50 border-yellow-200 border-yellow-600";
      case "alert":
        return "bg-red-50 border-red-200 border-red-600";
      default:
        return "bg-blue-50 border-blue-200 border-blue-600";
    }
  };

  const getIconColor = (severity) => {
    switch (severity) {
      case "warning":
        return "text-yellow-600";
      case "alert":
        return "text-red-600";
      default:
        return "text-blue-600";
    }
  };

  const getIconBgColor = (severity) => {
    switch (severity) {
      case "warning":
        return "bg-yellow-100";
      case "alert":
        return "bg-red-100";
      default:
        return "bg-blue-100";
    }
  };

  const handleClearAll = () => {
    // Lưu ý: Hàm này chỉ xóa trên Frontend. Dữ liệu vẫn còn trên Firebase.
    setNotifications([]);
  };

  const handleRemoveNotification = (id) => {
    setNotifications(notifications.filter((notif) => notif.id !== id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left Side */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/home")}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Bell className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">
                  Notifications
                </h1>
              </div>
            </div>
            {/* Right Side */}
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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          {/* Title and Count (left) */}
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-gray-900">
              All Notifications
            </h2>
            {notifications.length > 0 && (
              <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-semibold rounded-full">
                {notifications.length}
              </span>
            )}
          </div>
          {/* Clear All Button (right) */}
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-gray-300 hover:border-red-300"
            >
              Clear All
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Notifications
            </h3>
            <p className="text-gray-500">No new notifications to show.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => {
              const Icon = notif.icon;
              if (!Icon) return null;

              return (
                <div
                  key={notif.id}
                  className={`rounded-xl shadow-md border-l-4 ${getSeverityColor(
                    notif.severity
                  )} hover:shadow-lg transition-shadow p-5`}
                >
                  <div className="flex gap-4">
                    {/* Icon + Action (left) */}
                    <div
                      className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${getIconBgColor(
                        notif.severity
                      )}`}
                    >
                      <Icon
                        className={`w-6 h-6 ${getIconColor(notif.severity)}`}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {notif.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {notif.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">{notif.time}</p>
                    </div>
                    {/* Remove Button (right) */}
                    <button
                      onClick={() => handleRemoveNotification(notif.id)}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Notifications;
