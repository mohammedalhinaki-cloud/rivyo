/**
 * يولّد قيمًا سرية عشوائية لـ .env.local
 * الاستخدام: npm run keys
 */
import { randomBytes } from "node:crypto";

console.log("انسخ السطرين التاليين إلى ملف .env.local (كل قيمة تُنشأ مرة واحدة):\n");
console.log(`SESSION_SECRET=${randomBytes(48).toString("base64url")}`);
console.log(`ENCRYPTION_KEY=${randomBytes(32).toString("base64url")}`);
