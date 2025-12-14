import "dotenv/config";
import admin from "firebase-admin";
// 2. Import thư viện Node.js để xử lý đường dẫn (cần thiết trong môi trường ES Modules)
import path from "path";
import { fileURLToPath } from "url";

// Lấy đường dẫn thư mục hiện tại (tương đương __dirname trong CommonJS)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 3. Tải đường dẫn Service Account Key từ Biến Môi trường
const serviceAccountPath = process.env.SERVICE_ACCOUNT_KEY_PATH;

if (!serviceAccountPath) {
  console.error(
    "FATAL ERROR: SERVICE_ACCOUNT_KEY_PATH is not set in environment variables."
  );
  // Thoát ứng dụng nếu khóa bảo mật không được tìm thấy
  process.exit(1);
}

// Chuyển đổi đường dẫn tương đối thành đường dẫn tuyệt đối
const absoluteServiceAccountPath = path.resolve(
  __dirname,
  "..",
  serviceAccountPath
);

// 4. Khởi tạo Admin SDK (sử dụng đường dẫn tuyệt đối)
admin.initializeApp({
  credential: admin.credential.cert(absoluteServiceAccountPath),
  databaseURL: process.env.FIREBASE_DB_URL, // Tải DB URL từ .env
});

const db = admin.firestore();
const serverTime = admin.firestore.FieldValue.serverTimestamp;

export { db, serverTime };
