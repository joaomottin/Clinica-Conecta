import { beforeEach, describe, expect, it } from "vitest";

import { todayInTimeZone } from "@/lib/clinic/availability";
import { memoryClinicRepository, resetMemoryRepositoryForTests } from "@/lib/clinic/memory-repository";
import { cancelBooking, createBooking, findAvailability, listAdminAppointments } from "@/lib/clinic/service";

function nextWeekdayDate() {
  const today = todayInTimeZone("America/Sao_Paulo");
  for (let offset = 1; offset <= 7; offset += 1) {
    const date = new Date(`${today}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    const weekday = date.getUTCDay();
    if (weekday >= 1 && weekday <= 5) return date.toISOString().slice(0, 10);
  }
  throw new Error("Nenhum dia útil encontrado.");
}

async function firstSlotToken() {
  const response = await findAvailability({
    servico: "clinica-geral",
    data_inicial: nextWeekdayDate(),
    periodo: "tarde",
    quantidade: 1,
    dias: 1,
  });
  return response.slots[0].slotToken;
}

function request(slotToken: string, name = "Paciente Teste", whatsapp = "41999990000") {
  return {
    slot_token: slotToken,
    nome_paciente: name,
    whatsapp,
    confirmacao_explicita: true,
    consentimento_demo: true,
    origem: "webmcp",
  };
}

describe("serviço de agendamento em memória", () => {
  beforeEach(() => resetMemoryRepositoryForTests());

  it("é idempotente para a repetição exata", async () => {
    const token = await firstSlotToken();
    const first = await createBooking(request(token), { clientIp: "198.51.100.10" });
    const replay = await createBooking(request(token), { clientIp: "198.51.100.10" });

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.confirmationCode).toBe(first.confirmationCode);
    expect(await listAdminAppointments()).toHaveLength(1);
  });

  it("aceita só uma de duas reservas simultâneas para o mesmo horário", async () => {
    const token = await firstSlotToken();
    const results = await Promise.allSettled([
      createBooking(request(token, "Paciente Alfa", "41999990001"), { clientIp: "198.51.100.11" }),
      createBooking(request(token, "Paciente Beta", "41999990002"), { clientIp: "198.51.100.12" }),
    ]);

    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((item) => item.status === "rejected");
    expect(rejected).toMatchObject({ reason: { status: 409, code: "SLOT_CONFLICT" } });
  });

  it("libera o horário depois do cancelamento", async () => {
    const token = await firstSlotToken();
    const created = await createBooking(request(token), { clientIp: "198.51.100.13" });
    const [stored] = await listAdminAppointments();
    await cancelBooking(stored.id);
    const availability = await findAvailability({
      servico: "clinica-geral",
      data_inicial: nextWeekdayDate(),
      periodo: "tarde",
      quantidade: 10,
      dias: 1,
    });

    expect(availability.slots.some((slot) => slot.startsAt === created.appointment.startsAt)).toBe(true);
  });

  it("aplica limite por chave sem guardar IP ou contato", async () => {
    expect(await memoryClinicRepository.consumeRateLimit("x".repeat(64), 3600, 2)).toBe(true);
    expect(await memoryClinicRepository.consumeRateLimit("x".repeat(64), 3600, 2)).toBe(true);
    expect(await memoryClinicRepository.consumeRateLimit("x".repeat(64), 3600, 2)).toBe(false);
  });
});
