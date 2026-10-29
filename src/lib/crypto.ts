import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
export const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, stored: string) {
  const [salt, value] = stored.split(":");
  if (!salt || !value || value.length !== 128) return false;
  return timingSafeEqual(
    Buffer.from(value, "hex"),
    scryptSync(password, salt, 64),
  );
}
