import type {
  AppointmentRecord,
  ClinicCatalog,
  CreateAppointmentInput,
  CreateAppointmentResult,
} from "@/lib/clinic/types";

export class RepositoryConflictError extends Error {}
export class RepositoryNotFoundError extends Error {}

type RepositoryErrorDiagnostics = {
  name: string;
  code?: string;
  causeCode?: string;
};

export class RepositoryUnavailableError extends Error {
  constructor(
    public operation: string,
    public diagnostics: RepositoryErrorDiagnostics,
  ) {
    super("O repositório da clínica está temporariamente indisponível.");
    this.name = "RepositoryUnavailableError";
  }
}

export interface ClinicRepository {
  getCatalog(): Promise<ClinicCatalog>;
  listAppointments(range?: { from: string; to: string }): Promise<AppointmentRecord[]>;
  createAppointment(input: CreateAppointmentInput): Promise<CreateAppointmentResult>;
  cancelAppointment(id: string): Promise<AppointmentRecord>;
  consumeRateLimit(keyHash: string, windowSeconds: number, maximum: number): Promise<boolean>;
  health(): Promise<{ storage: "memory" | "supabase"; ok: boolean }>;
}

const READ_RETRY_DELAYS_MS = [200, 600];

function stringProperty(value: unknown, property: string) {
  if (!value || typeof value !== "object" || !(property in value)) return undefined;
  const candidate = (value as Record<string, unknown>)[property];
  return typeof candidate === "string" ? candidate : undefined;
}

function describeRepositoryError(error: unknown): RepositoryErrorDiagnostics {
  const cause = error instanceof Error ? error.cause : undefined;

  return {
    name: error instanceof Error ? error.name : "UnknownError",
    code: stringProperty(error, "code"),
    causeCode: stringProperty(cause, "code"),
  };
}

export async function withRepositoryReadRetry<T>(
  operation: string,
  read: () => Promise<T>,
  delaysMs: readonly number[] = READ_RETRY_DELAYS_MS,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= delaysMs.length; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      lastError = error;
      const delay = delaysMs[attempt];
      if (delay === undefined) break;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new RepositoryUnavailableError(operation, describeRepositoryError(lastError));
}

class ResilientClinicRepository implements ClinicRepository {
  constructor(private repository: ClinicRepository) {}

  getCatalog() {
    return withRepositoryReadRetry("getCatalog", () => this.repository.getCatalog());
  }

  listAppointments(range?: { from: string; to: string }) {
    return withRepositoryReadRetry("listAppointments", () => this.repository.listAppointments(range));
  }

  createAppointment(input: CreateAppointmentInput) {
    return this.repository.createAppointment(input);
  }

  cancelAppointment(id: string) {
    return this.repository.cancelAppointment(id);
  }

  consumeRateLimit(keyHash: string, windowSeconds: number, maximum: number) {
    return this.repository.consumeRateLimit(keyHash, windowSeconds, maximum);
  }

  health() {
    return this.repository.health();
  }
}

let repositoryPromise: Promise<ClinicRepository> | undefined;

async function createClinicRepository(): Promise<ClinicRepository> {
  const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

  if (hasSupabase) {
    const { supabaseClinicRepository } = await import("@/lib/clinic/supabase-repository");
    return new ResilientClinicRepository(supabaseClinicRepository);
  }

  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    throw new Error("SUPABASE_URL e SUPABASE_SECRET_KEY são obrigatórios em produção.");
  }

  const { memoryClinicRepository } = await import("@/lib/clinic/memory-repository");
  return new ResilientClinicRepository(memoryClinicRepository);
}

export async function getClinicRepository(): Promise<ClinicRepository> {
  repositoryPromise ??= createClinicRepository();

  try {
    return await repositoryPromise;
  } catch (error) {
    repositoryPromise = undefined;
    throw error;
  }
}
