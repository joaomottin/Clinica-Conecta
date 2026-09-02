import { describe, expect, it } from "vitest";

import { buildAvailability } from "@/lib/clinic/availability";
import { DEMO_CATALOG } from "@/lib/clinic/constants";
import type { AppointmentRecord } from "@/lib/clinic/types";

describe("cálculo de disponibilidade", () => {
  const now = new Date("2026-09-01T12:00:00.000Z");

  it("oferece apenas blocos futuros da agenda no fuso de São Paulo", () => {
    const slots = buildAvailability(DEMO_CATALOG, [], {
      serviceSlug: "clinica-geral",
      fromDate: "2026-09-01",
      period: "manha",
      limit: 10,
      days: 1,
      now,
    });

    expect(slots.map((item) => item.label)).toEqual(["09:30", "10:00", "10:30", "11:00", "11:30"]);
    expect(slots.every((item) => item.dateLabel.includes("terça-feira"))).toBe(true);
  });

  it("não oferece fins de semana nem horários já ocupados", () => {
    const initial = buildAvailability(DEMO_CATALOG, [], {
      serviceSlug: "clinica-geral",
      fromDate: "2026-09-02",
      period: "tarde",
      limit: 2,
      days: 1,
      now,
    });
    const occupied: AppointmentRecord = {
      id: "77777777-7777-4777-8777-777777777777",
      confirmationCode: "CL-TESTE001",
      idempotencyKey: "test",
      clinicId: initial[0].clinicId,
      serviceId: initial[0].serviceId,
      serviceName: initial[0].serviceName,
      professionalId: initial[0].professionalId,
      professionalName: initial[0].professionalName,
      startsAt: initial[0].startsAt,
      endsAt: initial[0].endsAt,
      patientName: "Paciente Teste",
      patientWhatsapp: "+5541999990000",
      status: "confirmed",
      source: "web",
      createdAt: now.toISOString(),
      cancelledAt: null,
    };
    const afterBooking = buildAvailability(DEMO_CATALOG, [occupied], {
      serviceSlug: "clinica-geral",
      fromDate: "2026-09-02",
      period: "tarde",
      limit: 2,
      days: 1,
      now,
    });
    const weekend = buildAvailability(DEMO_CATALOG, [], {
      serviceSlug: "clinica-geral",
      fromDate: "2026-09-05",
      period: "qualquer",
      limit: 10,
      days: 1,
      now,
    });

    expect(afterBooking.some((item) => item.startsAt === occupied.startsAt)).toBe(false);
    expect(weekend).toEqual([]);
  });

  it("rejeita datas passadas ou além de 14 dias", () => {
    expect(() => buildAvailability(DEMO_CATALOG, [], { serviceSlug: "clinica-geral", fromDate: "2026-08-31", period: "qualquer", limit: 1, days: 1, now })).toThrow(/Escolha uma data/);
    expect(() => buildAvailability(DEMO_CATALOG, [], { serviceSlug: "clinica-geral", fromDate: "2026-09-16", period: "qualquer", limit: 1, days: 1, now })).toThrow(/Escolha uma data/);
  });
});
