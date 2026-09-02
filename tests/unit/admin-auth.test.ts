import { describe, expect, it } from "vitest";

import { createAdminSessionToken, verifyAdminPassword, verifyAdminSessionToken } from "@/lib/admin-session";

describe("sessão administrativa assinada", () => {
  it("aceita a senha local e rejeita outra", () => {
    expect(verifyAdminPassword("demo-admin")).toBe(true);
    expect(verifyAdminPassword("incorreta")).toBe(false);
  });

  it("detecta expiração e adulteração do cookie", () => {
    const now = new Date("2026-09-01T12:00:00.000Z");
    const token = createAdminSessionToken(now);
    expect(verifyAdminSessionToken(token, new Date("2026-09-01T19:59:59.000Z"))).toBe(true);
    expect(verifyAdminSessionToken(token, new Date("2026-09-01T20:00:01.000Z"))).toBe(false);
    expect(verifyAdminSessionToken(`${token.slice(0, -1)}x`, now)).toBe(false);
  });
});
