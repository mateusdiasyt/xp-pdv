import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const SECRET_PREFIX = "v1";
const ALGORITHM = "aes-256-gcm";

function getSecretKey() {
  const rawKey = process.env.FISCAL_ENCRYPTION_KEY?.trim();

  if (!rawKey) {
    throw new Error("Configure FISCAL_ENCRYPTION_KEY no ambiente para salvar tokens fiscais.");
  }

  return createHash("sha256").update(rawKey).digest();
}

export function encryptSecretValue(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(normalizedValue, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [SECRET_PREFIX, iv.toString("base64url"), authTag.toString("base64url"), encrypted.toString("base64url")].join(
    ":",
  );
}

export function decryptSecretValue(value?: string | null) {
  if (!value) {
    return null;
  }

  const [version, rawIv, rawAuthTag, rawEncrypted] = value.split(":");

  if (version !== SECRET_PREFIX || !rawIv || !rawAuthTag || !rawEncrypted) {
    return null;
  }

  const decipher = createDecipheriv(ALGORITHM, getSecretKey(), Buffer.from(rawIv, "base64url"));
  decipher.setAuthTag(Buffer.from(rawAuthTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(rawEncrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
