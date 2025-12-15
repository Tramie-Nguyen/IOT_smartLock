import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Settings as SettingsIcon,
  ArrowLeft,
  Home as HomeIcon,
  Lock,
  User,
} from "lucide-react";
import { socket } from "../socket";
import axios from "axios";

const Settings = () => {
  const navigate = useNavigate();
  const [oldAccountPassword, setOldAccountPassword] = useState("");
  const [oldLockPassword, setOldLockPassword] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState("");
  const [lockPassword, setLockPassword] = useState("");
  const [lockPasswordConfirm, setLockPasswordConfirm] = useState("");
  const [showAccountPass, setShowAccountPass] = useState(false);
  const [showAccountPassConfirm, setShowAccountPassConfirm] = useState(false);
  const [showLockPass, setShowLockPass] = useState(false);
  const [showLockPassConfirm, setShowLockPassConfirm] = useState(false);
  const [showOldLockPass, setShowOldLockPass] = useState(false);
  const [showOldAccountPass, setShowOldAccountPass] = useState(false);

  // Lắng nghe phản hồi từ ESP qua socket
  useEffect(() => {
    const handleLockPasswordResponse = (data) => {
      const message = data.message;

      if (message === "JSON_ERROR") {
        alert("Error: Invalid data format");
      } else if (message === "WRONG_OLD_PASSWORD") {
        alert("Error: Wrong old password");
      } else if (message === "SUCCESS") {
        alert("Lock password updated successfully");
        setOldLockPassword("");
        setLockPassword("");
        setLockPasswordConfirm("");
        setShowLockPass(false);
        setShowLockPassConfirm(false);
      }
    };

    socket.on("051_428_475/esp/change_pw/res", handleLockPasswordResponse);

    return () => {
      socket.off("051_428_475/esp/change_pw/res", handleLockPasswordResponse);
    };
  }, []);

  const handleAccountPasswordChange = (e) => {
    e.preventDefault();

    if (accountPassword !== accountPasswordConfirm) {
      alert("Passwords do not match");
      return;
    }
    if (accountPassword.length < 8) {
      alert("Password must be at least 8 characters");
      return;
    }

    // TODO: Add API call to update password
    alert("Account password updated successfully");
    setAccountPassword("");
    setAccountPasswordConfirm("");
    setShowAccountPass(false);
    setShowAccountPassConfirm(false);
  };

  const handleLockPasswordChange = async (e) => {
    e.preventDefault();

    if (lockPassword !== lockPasswordConfirm) {
      alert("Lock passwords do not match");
      return;
    }
    if (lockPassword.length < 4 || lockPassword.length > 6) {
      alert("Lock password must be 4-6 digits");
      return;
    }
    if (!/^\d+$/.test(lockPassword)) {
      alert("Lock password must contain only numbers");
      return;
    }

    try {
      // Gọi API để đổi mật khẩu khóa
      const response = await axios.post(
        "http://localhost:3000/api/change-lock-password",
        {
          oldLockPassword: oldLockPassword,
          newLockPassword: lockPassword,
        }
      );

      alert("Lock password change request sent. Waiting for ESP response...");
    } catch (error) {
      console.error("Error changing lock password:", error);
      if (
        error.response &&
        error.response.data &&
        error.response.data.message
      ) {
        alert(`Error: ${error.response.data.message}`);
      } else {
        alert("Error: Could not connect to server");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* <- + icon, Settings (left) */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/home")}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <SettingsIcon className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">Settings</h1>
              </div>
            </div>
            {/* Home button (right) */}
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
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Account Password Section */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              {" "}
              {/* Icon and Title */}
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                Change Account Password
              </h2>
            </div>

            <form onSubmit={handleAccountPasswordChange} className="space-y-4">
              {/* Old Password Field */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Old Password
                </label>
                <div className="relative">
                  <input
                    type={showOldAccountPass ? "text" : "password"}
                    value={oldAccountPassword}
                    onChange={(e) => setOldAccountPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                    placeholder="Enter old password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldAccountPass(!showOldAccountPass)}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                  >
                    {showOldAccountPass ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              {/* New Password Field */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showAccountPass ? "text" : "password"}
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                    placeholder="Enter new password (min 8 characters)"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccountPass(!showAccountPass)}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                  >
                    {showAccountPass ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              {/* Confirm Password Field */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showAccountPassConfirm ? "text" : "password"}
                    value={accountPasswordConfirm}
                    onChange={(e) => setAccountPasswordConfirm(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                    placeholder="Confirm new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowAccountPassConfirm(!showAccountPassConfirm)
                    }
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                  >
                    {showAccountPassConfirm ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-200 shadow-lg"
              >
                Update Account Password
              </button>
            </form>
          </div>

          {/* Lock Password Section */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              {" "}
              {/* Icon and Title */}
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <Lock className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                Change Door Lock Password
              </h2>
            </div>

            <form onSubmit={handleLockPasswordChange} className="space-y-4">
              {/* Old Lock Password Field */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Old Lock Password (PIN)
                </label>
                <div className="relative">
                  <input
                    type={showOldLockPass ? "text" : "password"}
                    value={oldLockPassword}
                    onChange={(e) => setOldLockPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition duration-200"
                    placeholder="Enter old PIN"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldLockPass(!showOldLockPass)}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                  >
                    {showOldLockPass ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              {/* New Lock Password Field */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  New Lock Password (PIN)
                </label>
                <div className="relative">
                  <input
                    type={showLockPass ? "text" : "password"}
                    value={lockPassword}
                    onChange={(e) => setLockPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition duration-200"
                    placeholder="Enter new PIN (4-6 digits)"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLockPass(!showLockPass)}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                  >
                    {showLockPass ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              {/* Confirm Lock Password Field */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Confirm Lock Password
                </label>
                <div className="relative">
                  <input
                    type={showLockPassConfirm ? "text" : "password"}
                    value={lockPasswordConfirm}
                    onChange={(e) => setLockPasswordConfirm(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition duration-200"
                    placeholder="Confirm PIN"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLockPassConfirm(!showLockPassConfirm)}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                  >
                    {showLockPassConfirm ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition duration-200 shadow-lg"
              >
                Update Lock Password
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
