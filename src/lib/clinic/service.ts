import { addDays } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

import { buildAvailability } from "@/lib/clinic/availability";
import { availabilityQuerySchema, bookingRequestSchema, normalizeBrazilianWhatsapp } from "@/lib/clinic/schemas";
import { createSlotToken, keyedHash, verifySlotToken } from "@/lib/clinic/token";
import {
  getClinicRepository,
  RepositoryConflictError,
  RepositoryNotFoundError,
} from "@/lib/clinic/repository";

export class ClinicServiceError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

export async function getClinicInfo() {
  const repository = await getClinicRepository();
  const catalog = await repository.getCatalog();

  return {
    clinic: catalog.clinic,
    services: catalog.services.map(({ id, name, slug, description, durationMinutes }) => ({
      id,
      name,
      slug,
      description,
      durationMinutes,
    })),
    notice: "Ambiente fictício de demonstração. Não presta atendimento médico.",
  };
}

export async function findAvailability(rawInput: unknown) {
  const parsed = availabilityQuerySchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ClinicServiceError(parsed.error.issues[0]?.message ?? "Consulta inválida.", 400, "INVALID_QUERY");
  }

  const repository = await getClinicRepository();
  const catalog = await repository.getCatalog();
  const from = fromZonedTime(`${parsed.data.data_inicial}T00:00:00`, catalog.clinic.timezone);
  const to = addDays(from, parsed.data.dias);
  const appointments = await repository.listAppointments({ from: from.toISOString(), to: to.toISOString() });

  try {
    const slots = buildAvailability(catalog, appointments, {
      serviceSlug: parsed.data.servico,
      fromDate: parsed.data.data_inicial,
      period: parsed.data.periodo,
      limit: parsed.data.quantidade,
      days: parsed.data.dias,
    }).map((slot) => ({ ...slot, slotToken: createSlotToken(slot) }));

    return {
      clinic: { name: catalog.clinic.name, timezone: catalog.clinic.timezone },
      service: catalog.services.find((service) => service.slug === parsed.data.servico)?.name,
      slots,
      notice: slots.length
        ? "Horários válidos por 10 minutos. Confirme novamente antes de agendar."
        : "Nenhum horário encontrado para os filtros escolhidos.",
    };
  } catch (error) {
    throw new ClinicServiceError(error instanceof Error ? error.message : "Não foi possível consultar horários.", 400, "AVAILABILITY_ERROR");
  }
}

export async function createBooking(rawInput: unknown, context: { clientIp: string }) {
  const parsed = bookingRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ClinicServiceError(parsed.error.issues[0]?.message ?? "Dados de agendamento inválidos.", 400, "INVALID_BOOKING");
  }

  let whatsapp: string;
  try {
    whatsapp = normalizeBrazilianWhatsapp(parsed.data.whatsapp);
  } catch (error) {
    throw new ClinicServiceError(error instanceof Error ? error.message : "WhatsApp inválido.", 400, "INVALID_WHATSAPP");
  }

  let slot;
  try {
    slot = verifySlotToken(parsed.data.slot_token);
  } catch (error) {
    throw new ClinicServiceError(error instanceof Error ? error.message : "Token de horário inválido.", 400, "INVALID_SLOT_TOKEN");
  }

  const repository = await getClinicRepository();
  const [ipAllowed, contactAllowed] = await Promise.all([
    repository.consumeRateLimit(keyedHash(context.clientIp, "booking-ip"), 60 * 60, 10),
    repository.consumeRateLimit(keyedHash(whatsapp, "booking-contact"), 60 * 60, 5),
  ]);

  if (!ipAllowed || !contactAllowed) {
    throw new ClinicServiceError("Muitas tentativas de agendamento. Aguarde uma hora e tente novamente.", 429, "RATE_LIMITED");
  }

  const idempotencyKey = keyedHash(
    `${parsed.data.slot_token}:${parsed.data.nome_paciente.trim().toLocaleLowerCase("pt-BR")}:${whatsapp}`,
    "booking-idempotency",
  );

  try {
    const result = await repository.createAppointment({
      idempotencyKey,
      clinicId: slot.clinicId,
      serviceId: slot.serviceId,
      professionalId: slot.professionalId,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      patientName: parsed.data.nome_paciente.trim(),
      patientWhatsapp: whatsapp,
      source: parsed.data.origem,
    });

    return {
      status: "confirmed" as const,
      replayed: result.replayed,
      confirmationCode: result.appointment.confirmationCode,
      appointment: {
        service: result.appointment.serviceName,
        professional: result.appointment.professionalName,
        startsAt: result.appointment.startsAt,
        endsAt: result.appointment.endsAt,
      },
      notice: "Agendamento fictício criado apenas para demonstração técnica.",
    };
  } catch (error) {
    if (error instanceof RepositoryConflictError) {
      throw new ClinicServiceError("Este horário acabou de ser ocupado. Consulte novas opções.", 409, "SLOT_CONFLICT");
    }
    if (error instanceof RepositoryNotFoundError) {
      throw new ClinicServiceError("O serviço ou profissional não está mais disponível.", 404, "CATALOG_ITEM_NOT_FOUND");
    }
    throw error;
  }
}

export async function listAdminAppointments() {
  const repository = await getClinicRepository();
  return repository.listAppointments();
}

export async function cancelBooking(id: string) {
  const repository = await getClinicRepository();

  try {
    return await repository.cancelAppointment(id);
  } catch (error) {
    if (error instanceof RepositoryNotFoundError) {
      throw new ClinicServiceError("Agendamento não encontrado ou já cancelado.", 404, "APPOINTMENT_NOT_FOUND");
    }
    throw error;
  }
}
