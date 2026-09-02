import { describe, expect, it } from "vitest";

import { createSlotToken, verifySlotToken } from "@/lib/clinic/token";
import type { AvailabilitySlot } from "@/lib/clinic/types";

const slot: AvailabilitySlot = {
  clinicId: "11111111-1111-4111-8111-111111111111",
  serviceId: "22222222-2222-4222-8222-222222222222",
  serviceSlug: "clinica-geral",
  serviceName: "Consulta de Clínica Geral",
  professionalId: "33333333-3333-4333-8333-333333333333",
  professionalName: "Profissional de Demonstração",
  startsAt: "2026-09-02T17:00:00.000Z",
  endsAt: "2026-09-02T17:30:00.000Z",
  label: "14:00",
  dateLabel: "quarta-feira, 02 de setembro",
};

describe("tokens assinados de horário", () => {
  it("preserva os dados e expira em dez minutos", () => {
    const issuedAt = new Date("2026-09-01T12:00:00.000Z");
    const token = createSlotToken(slot, issuedAt);
    expect(verifySlotToken(token, new Date("2026-09-01T12:09:59.000Z")).startsAt).toBe(slot.startsAt);
    expect(() => verifySlotToken(token, new Date("2026-09-01T12:10:01.000Z"))).toThrow(/expirou/);
  });

  it("detecta qualquer alteração manual", () => {
    const token = createSlotToken(slot, new Date("2026-09-01T12:00:00.000Z"));
    expect(() => verifySlotToken(`${token.slice(0, -1)}x`, new Date("2026-09-01T12:01:00.000Z"))).toThrow(/adulterado/);
  });
});
