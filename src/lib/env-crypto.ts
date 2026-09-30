/**
 * تشفير/فك تشفير الرموز الحساسة (Access/Refresh Tokens) بمعيار AES-256-GCM.
 * المفتاح يأتي من ENCRYPTION_KEY (32 بايت بصيغة base64url) ولا يغادر السيرفر أبدًا.
 */
import crypto from "node:crypto";

const PREFIX = "v1";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY غير مضبوط — شغّل npm run keys وضعه في .env.local");
  }
  const key = Buffer.from(raw, "base64url");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY يجب أن يكون 32 بايت بصيغة base64url (أنشئه عبر npm run keys)");
  }
  return key;
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(enc: string): string {
  const parts = enc.split(".");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error("صيغة النص المشفر غير صالحة");
  }
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const ciphertext = Buffer.from(parts[3], "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}
