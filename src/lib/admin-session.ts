import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_DURATION_SECONDS = 8 * 60 * 60;

type SessionPayload = {
  v: 1;
  exp: number;
};

function requiredSecret(name: "ADMIN_PASSWORD" | "ADMIN_SESSION_SECRET") {
  const value = process.env[name];
  if (value) return value;

  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error(`${name} não está configurado.`);
  }

  return name === "ADMIN_PASSWORD" ? "demo-admin" : "clinic-admin-local-development-secret-change-me";
}

function sign(value: string) {
  return createHmac("sha256", requiredSecret("ADMIN_SESSION_SECRET")).update(value).digest("base64url");
}

function equalsSafely(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyAdminPassword(password: string) {
  return equalsSafely(password, requiredSecret("ADMIN_PASSWORD"));
}

export function createAdminSessionToken(now = new Date()) {
  const payload: SessionPayload = {
    v: 1,
    exp: Math.floor(now.getTime() / 1000) + ADMIN_SESSION_DURATION_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyAdminSessionToken(token: string | undefined, now = new Date()) {
  if (!token) return false;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || !equalsSafely(signature, sign(encoded))) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    return payload.v === 1 && Number.isInteger(payload.exp) && payload.exp > Math.floor(now.getTime() / 1000);
  } catch {
    return false;
  }
}
