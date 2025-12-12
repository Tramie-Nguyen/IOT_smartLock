import { publishToEsp } from "./mqtt.js";

const changeLockPassword = (req, res) => {
    try {
        const { oldLockPassword, newLockPassword } = req.body;
        
        if (!oldLockPassword || !newLockPassword) {
            return res.status(400).json({ message: "Old and new lock passwords are required." });
        }

        // kiểm tra mật khẩu (chỉ được là số và độ dài 4 tới 6 và chỉ toàn là số)
        if (!/^\d{4,6}$/.test(newLockPassword)) {
            return res.status(400).json({ message: "New lock password must be 4-6 digits and contain only numbers." });
        }

        // Gửi lệnh đổi mật khẩu cho ESP qua MQTT
        publishToEsp("051_428_475/esp/change_pw", JSON.stringify({oldPW: oldLockPassword, newPW: newLockPassword }));

        return res.status(200).json({ message: "Lock password change request sent." });
    } catch (error) {
        console.error("Error changing lock password:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
};

export { changeLockPassword };