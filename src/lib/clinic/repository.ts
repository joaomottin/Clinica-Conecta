import type {
  AppointmentRecord,
  ClinicCatalog,
  CreateAppointmentInput,
  CreateAppointmentResult,
} from "@/lib/clinic/types";

export class RepositoryConflictError extends Error {}
export class RepositoryNotFoundError extends Error {}

export interface ClinicRepository {
  getCatalog(): Promise<ClinicCatalog>;
  listAppointments(range?: { from: string; to: string }): Promise<AppointmentRecord[]>;
  createAppointment(input: CreateAppointmentInput): Promise<CreateAppointmentResult>;
  cancelAppointment(id: string): Promise<AppointmentRecord>;
  consumeRateLimit(keyHash: string, windowSeconds: number, maximum: number): Promise<boolean>;
  health(): Promise<{ storage: "memory" | "supabase"; ok: boolean }>;
}

export async function getClinicRepository(): Promise<ClinicRepository> {
  const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

  if (hasSupabase) {
    const { SupabaseClinicRepository } = await import("@/lib/clinic/supabase-repository");
    return new SupabaseClinicRepository();
  }

  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    throw new Error("SUPABASE_URL e SUPABASE_SECRET_KEY são obrigatórios em produção.");
  }

  const { memoryClinicRepository } = await import("@/lib/clinic/memory-repository");
  return memoryClinicRepository;
}
