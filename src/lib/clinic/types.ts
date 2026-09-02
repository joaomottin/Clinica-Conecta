export type Clinic = {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  timezone: string;
  isDemo: boolean;
};

export type ClinicService = {
  id: string;
  clinicId: string;
  name: string;
  slug: string;
  description: string;
  durationMinutes: number;
  active: boolean;
};

export type Professional = {
  id: string;
  clinicId: string;
  name: string;
  active: boolean;
};

export type ProfessionalService = {
  clinicId: string;
  professionalId: string;
  serviceId: string;
};

export type WeeklyAvailability = {
  id: string;
  clinicId: string;
  professionalId: string;
  isoWeekday: number;
  startTime: string;
  endTime: string;
  slotIntervalMinutes: number;
  active: boolean;
};

export type ClinicCatalog = {
  clinic: Clinic;
  services: ClinicService[];
  professionals: Professional[];
  professionalServices: ProfessionalService[];
  weeklyAvailability: WeeklyAvailability[];
};

export type AppointmentStatus = "confirmed" | "cancelled";
export type AppointmentSource = "web" | "webmcp" | "admin";

export type AppointmentRecord = {
  id: string;
  confirmationCode: string;
  idempotencyKey: string;
  clinicId: string;
  serviceId: string;
  serviceName: string;
  professionalId: string;
  professionalName: string;
  startsAt: string;
  endsAt: string;
  patientName: string;
  patientWhatsapp: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  createdAt: string;
  cancelledAt: string | null;
};

export type AvailabilitySlot = {
  clinicId: string;
  serviceId: string;
  serviceSlug: string;
  serviceName: string;
  professionalId: string;
  professionalName: string;
  startsAt: string;
  endsAt: string;
  label: string;
  dateLabel: string;
};

export type SignedAvailabilitySlot = AvailabilitySlot & {
  slotToken: string;
};

export type CreateAppointmentInput = {
  idempotencyKey: string;
  clinicId: string;
  serviceId: string;
  professionalId: string;
  startsAt: string;
  endsAt: string;
  patientName: string;
  patientWhatsapp: string;
  source: AppointmentSource;
};

export type CreateAppointmentResult = {
  appointment: AppointmentRecord;
  replayed: boolean;
};
