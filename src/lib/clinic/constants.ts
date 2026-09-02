import type { ClinicCatalog } from "@/lib/clinic/types";

export const DEMO_CLINIC_ID = "11111111-1111-4111-8111-111111111111";
export const DEMO_SERVICE_ID = "22222222-2222-4222-8222-222222222222";
export const DEMO_PROFESSIONAL_ID = "33333333-3333-4333-8333-333333333333";

const schedule = [1, 2, 3, 4, 5].flatMap((isoWeekday) => [
  {
    id: `44444444-4444-4444-8${isoWeekday}01-444444444444`,
    clinicId: DEMO_CLINIC_ID,
    professionalId: DEMO_PROFESSIONAL_ID,
    isoWeekday,
    startTime: "09:00",
    endTime: "12:00",
    slotIntervalMinutes: 30,
    active: true,
  },
  {
    id: `44444444-4444-4444-8${isoWeekday}02-444444444444`,
    clinicId: DEMO_CLINIC_ID,
    professionalId: DEMO_PROFESSIONAL_ID,
    isoWeekday,
    startTime: "14:00",
    endTime: "17:00",
    slotIntervalMinutes: 30,
    active: true,
  },
]);

export const DEMO_CATALOG: ClinicCatalog = {
  clinic: {
    id: DEMO_CLINIC_ID,
    name: "Clínica WebMCP Campo Largo — Demonstração",
    slug: "clinica-webmcp-campo-largo",
    city: "Campo Largo",
    state: "PR",
    timezone: "America/Sao_Paulo",
    isDemo: true,
  },
  services: [
    {
      id: DEMO_SERVICE_ID,
      clinicId: DEMO_CLINIC_ID,
      name: "Consulta de Clínica Geral",
      slug: "clinica-geral",
      description: "Consulta fictícia de 30 minutos para validar o fluxo de agendamento.",
      durationMinutes: 30,
      active: true,
    },
  ],
  professionals: [
    {
      id: DEMO_PROFESSIONAL_ID,
      clinicId: DEMO_CLINIC_ID,
      name: "Profissional de Demonstração",
      active: true,
    },
  ],
  professionalServices: [
    {
      clinicId: DEMO_CLINIC_ID,
      professionalId: DEMO_PROFESSIONAL_ID,
      serviceId: DEMO_SERVICE_ID,
    },
  ],
  weeklyAvailability: schedule,
};

export const CLINIC_TIMEZONE = "America/Sao_Paulo";
export const MAX_BOOKING_DAYS = 14;
