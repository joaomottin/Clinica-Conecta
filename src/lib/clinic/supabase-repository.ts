import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  RepositoryConflictError,
  RepositoryNotFoundError,
  type ClinicRepository,
} from "@/lib/clinic/repository";
import type {
  AppointmentRecord,
  ClinicCatalog,
  CreateAppointmentInput,
  CreateAppointmentResult,
} from "@/lib/clinic/types";

type DatabaseAppointmentRow = {
  id: string;
  confirmation_code: string;
  idempotency_key: string;
  clinic_id: string;
  service_id: string;
  professional_id: string;
  starts_at: string;
  ends_at: string;
  patient_name: string;
  patient_whatsapp: string;
  status: "confirmed" | "cancelled";
  source: "web" | "webmcp" | "admin";
  created_at: string;
  cancelled_at: string | null;
  service_name?: string;
  professional_name?: string;
  services?: { name: string } | null;
  professionals?: { name: string } | null;
  replayed?: boolean;
};

const CATALOG_CACHE_MS = 60_000;

class SupabaseRepositoryError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "SupabaseRepositoryError";
  }
}

function mapAppointment(row: DatabaseAppointmentRow): AppointmentRecord {
  return {
    id: row.id,
    confirmationCode: row.confirmation_code,
    idempotencyKey: row.idempotency_key,
    clinicId: row.clinic_id,
    serviceId: row.service_id,
    serviceName: row.service_name ?? row.services?.name ?? "Serviço",
    professionalId: row.professional_id,
    professionalName: row.professional_name ?? row.professionals?.name ?? "Profissional",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    patientName: row.patient_name,
    patientWhatsapp: row.patient_whatsapp,
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
  };
}

export class SupabaseClinicRepository implements ClinicRepository {
  private client: SupabaseClient;
  private catalog: ClinicCatalog | null = null;
  private catalogExpiresAt = 0;
  private catalogRequest: Promise<ClinicCatalog> | null = null;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;

    if (!url || !secret) {
      throw new Error("Credenciais do Supabase não configuradas.");
    }

    this.client = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private async loadCatalog(): Promise<ClinicCatalog> {
    const [clinicResult, servicesResult, professionalsResult, linksResult, availabilityResult] = await Promise.all([
      this.client.from("clinics").select("*").eq("active", true).single(),
      this.client.from("services").select("*").eq("active", true),
      this.client.from("professionals").select("*").eq("active", true),
      this.client.from("professional_services").select("*"),
      this.client.from("weekly_availability").select("*").eq("active", true),
    ]);

    const error = clinicResult.error ?? servicesResult.error ?? professionalsResult.error ?? linksResult.error ?? availabilityResult.error;
    if (error || !clinicResult.data) {
      throw new SupabaseRepositoryError(
        error?.message ?? "Clínica não encontrada.",
        error?.code ?? "CLINIC_NOT_FOUND",
      );
    }

    const clinic = clinicResult.data;

    return {
      clinic: {
        id: clinic.id,
        name: clinic.name,
        slug: clinic.slug,
        city: clinic.city,
        state: clinic.state,
        timezone: clinic.timezone,
        isDemo: clinic.is_demo,
      },
      services: (servicesResult.data ?? []).map((row) => ({
        id: row.id,
        clinicId: row.clinic_id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        durationMinutes: row.duration_minutes,
        active: row.active,
      })),
      professionals: (professionalsResult.data ?? []).map((row) => ({
        id: row.id,
        clinicId: row.clinic_id,
        name: row.name,
        active: row.active,
      })),
      professionalServices: (linksResult.data ?? []).map((row) => ({
        clinicId: row.clinic_id,
        professionalId: row.professional_id,
        serviceId: row.service_id,
      })),
      weeklyAvailability: (availabilityResult.data ?? []).map((row) => ({
        id: row.id,
        clinicId: row.clinic_id,
        professionalId: row.professional_id,
        isoWeekday: row.iso_weekday,
        startTime: row.start_time.slice(0, 5),
        endTime: row.end_time.slice(0, 5),
        slotIntervalMinutes: row.slot_interval_minutes,
        active: row.active,
      })),
    };
  }

  async getCatalog(): Promise<ClinicCatalog> {
    if (this.catalog && this.catalogExpiresAt > Date.now()) {
      return structuredClone(this.catalog);
    }

    if (!this.catalogRequest) {
      this.catalogRequest = this.loadCatalog()
        .then((catalog) => {
          this.catalog = catalog;
          this.catalogExpiresAt = Date.now() + CATALOG_CACHE_MS;
          return catalog;
        })
        .finally(() => {
          this.catalogRequest = null;
        });
    }

    return structuredClone(await this.catalogRequest);
  }

  async listAppointments(range?: { from: string; to: string }) {
    let query = this.client
      .from("appointments")
      .select("*, services(name), professionals(name)")
      .order("starts_at", { ascending: true });

    if (range) query = query.gte("starts_at", range.from).lt("starts_at", range.to);

    const { data, error } = await query;
    if (error) throw new SupabaseRepositoryError(error.message, error.code);

    return (data as DatabaseAppointmentRow[]).map(mapAppointment);
  }

  async createAppointment(input: CreateAppointmentInput): Promise<CreateAppointmentResult> {
    const { data, error } = await this.client.rpc("create_demo_appointment", {
      p_idempotency_key: input.idempotencyKey,
      p_clinic_id: input.clinicId,
      p_service_id: input.serviceId,
      p_professional_id: input.professionalId,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
      p_patient_name: input.patientName,
      p_patient_whatsapp: input.patientWhatsapp,
      p_source: input.source,
    });

    if (error) {
      if (error.message.includes("SLOT_CONFLICT")) throw new RepositoryConflictError("SLOT_CONFLICT");
      if (error.message.includes("CATALOG_ITEM_NOT_FOUND")) throw new RepositoryNotFoundError("CATALOG_ITEM_NOT_FOUND");
      throw new Error(error.message);
    }

    const row = (data as DatabaseAppointmentRow[] | null)?.[0];
    if (!row) throw new Error("O banco não retornou o agendamento criado.");

    return { appointment: mapAppointment(row), replayed: Boolean(row.replayed) };
  }

  async cancelAppointment(id: string) {
    const { data, error } = await this.client
      .from("appointments")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "confirmed")
      .select("*, services(name), professionals(name)")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new RepositoryNotFoundError("APPOINTMENT_NOT_FOUND");
    return mapAppointment(data as DatabaseAppointmentRow);
  }

  async consumeRateLimit(keyHash: string, windowSeconds: number, maximum: number) {
    const { data, error } = await this.client.rpc("consume_demo_rate_limit", {
      p_key_hash: keyHash,
      p_window_seconds: windowSeconds,
      p_maximum: maximum,
    });

    if (error) throw new Error(error.message);
    return Boolean(data);
  }

  async health() {
    const { error } = await this.client.from("clinics").select("id").limit(1);
    return { storage: "supabase" as const, ok: !error };
  }
}

export const supabaseClinicRepository = new SupabaseClinicRepository();
