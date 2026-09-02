import { addDays, addMinutes, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { MAX_BOOKING_DAYS } from "@/lib/clinic/constants";
import type {
  AppointmentRecord,
  AvailabilitySlot,
  ClinicCatalog,
} from "@/lib/clinic/types";

type BuildAvailabilityInput = {
  serviceSlug: string;
  fromDate: string;
  period: "manha" | "tarde" | "qualquer";
  limit: number;
  days: number;
  now?: Date;
};

function overlapsExisting(start: Date, end: Date, professionalId: string, appointments: AppointmentRecord[]) {
  return appointments.some((appointment) => {
    if (appointment.status !== "confirmed" || appointment.professionalId !== professionalId) return false;
    const bookedStart = new Date(appointment.startsAt);
    const bookedEnd = new Date(appointment.endsAt);
    return start < bookedEnd && end > bookedStart;
  });
}

export function todayInTimeZone(timezone: string, now = new Date()) {
  return formatInTimeZone(now, timezone, "yyyy-MM-dd");
}

function addCalendarDays(date: string, amount: number) {
  return addDays(new Date(`${date}T12:00:00.000Z`), amount).toISOString().slice(0, 10);
}

function isoWeekdayForDate(date: string) {
  const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function buildAvailability(
  catalog: ClinicCatalog,
  appointments: AppointmentRecord[],
  input: BuildAvailabilityInput,
): AvailabilitySlot[] {
  const { clinic } = catalog;
  const service = catalog.services.find((item) => item.slug === input.serviceSlug && item.active);

  if (!service) {
    throw new Error("Serviço não encontrado nesta clínica.");
  }

  const now = input.now ?? new Date();
  const today = todayInTimeZone(clinic.timezone, now);
  const latestAllowed = addCalendarDays(today, MAX_BOOKING_DAYS);

  if (input.fromDate < today || input.fromDate > latestAllowed) {
    throw new Error(`Escolha uma data entre ${today} e ${latestAllowed}.`);
  }

  const professionals = catalog.professionalServices
    .filter((link) => link.serviceId === service.id)
    .map((link) => catalog.professionals.find((professional) => professional.id === link.professionalId && professional.active))
    .filter((professional): professional is NonNullable<typeof professional> => Boolean(professional));

  const results: AvailabilitySlot[] = [];
  const daysToSearch = Math.min(input.days, MAX_BOOKING_DAYS);

  for (let dayOffset = 0; dayOffset < daysToSearch && results.length < input.limit; dayOffset += 1) {
    const dateKey = addCalendarDays(input.fromDate, dayOffset);

    if (dateKey > latestAllowed) break;

    const isoWeekday = isoWeekdayForDate(dateKey);

    for (const professional of professionals) {
      const blocks = catalog.weeklyAvailability.filter(
        (block) => block.professionalId === professional.id && block.isoWeekday === isoWeekday && block.active,
      );

      for (const block of blocks) {
        const blockStart = fromZonedTime(`${dateKey}T${block.startTime}:00`, clinic.timezone);
        const blockEnd = fromZonedTime(`${dateKey}T${block.endTime}:00`, clinic.timezone);

        for (
          let startsAt = blockStart;
          addMinutes(startsAt, service.durationMinutes) <= blockEnd;
          startsAt = addMinutes(startsAt, block.slotIntervalMinutes)
        ) {
          const endsAt = addMinutes(startsAt, service.durationMinutes);
          const hour = Number(formatInTimeZone(startsAt, clinic.timezone, "H"));
          const isMorning = hour < 12;

          if (isBefore(startsAt, addMinutes(now, 30))) continue;
          if (input.period === "manha" && !isMorning) continue;
          if (input.period === "tarde" && isMorning) continue;
          if (overlapsExisting(startsAt, endsAt, professional.id, appointments)) continue;

          results.push({
            clinicId: clinic.id,
            serviceId: service.id,
            serviceSlug: service.slug,
            serviceName: service.name,
            professionalId: professional.id,
            professionalName: professional.name,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            label: formatInTimeZone(startsAt, clinic.timezone, "HH:mm"),
            dateLabel: formatInTimeZone(startsAt, clinic.timezone, "EEEE, dd 'de' MMMM", { locale: ptBR }),
          });

          if (results.length >= input.limit) break;
        }

        if (results.length >= input.limit) break;
      }

      if (results.length >= input.limit) break;
    }
  }

  return results;
}
