import { randomUUID } from "node:crypto";

import { DEMO_CATALOG } from "@/lib/clinic/constants";
import {
  RepositoryConflictError,
  RepositoryNotFoundError,
  type ClinicRepository,
} from "@/lib/clinic/repository";
import type {
  AppointmentRecord,
  CreateAppointmentInput,
  CreateAppointmentResult,
} from "@/lib/clinic/types";

type MemoryState = {
  appointments: AppointmentRecord[];
  rateLimits: Map<string, { count: number; resetAt: number }>;
};

declare global {
  var __clinicWebMcpMemoryState: MemoryState | undefined;
}

const state: MemoryState = globalThis.__clinicWebMcpMemoryState ?? {
  appointments: [],
  rateLimits: new Map(),
};

globalThis.__clinicWebMcpMemoryState = state;

function confirmationCode() {
  return `CL-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

class MemoryClinicRepository implements ClinicRepository {
  async getCatalog() {
    return structuredClone(DEMO_CATALOG);
  }

  async listAppointments(range?: { from: string; to: string }) {
    return state.appointments
      .filter((appointment) => {
        if (!range) return true;
        return appointment.startsAt >= range.from && appointment.startsAt < range.to;
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((appointment) => ({ ...appointment }));
  }

  async createAppointment(input: CreateAppointmentInput): Promise<CreateAppointmentResult> {
    const existing = state.appointments.find((item) => item.idempotencyKey === input.idempotencyKey);

    if (existing) {
      return { appointment: { ...existing }, replayed: true };
    }

    const collision = state.appointments.some(
      (item) =>
        item.professionalId === input.professionalId &&
        item.status === "confirmed" &&
        input.startsAt < item.endsAt &&
        input.endsAt > item.startsAt,
    );

    if (collision) {
      throw new RepositoryConflictError("SLOT_CONFLICT");
    }

    const service = DEMO_CATALOG.services.find((item) => item.id === input.serviceId);
    const professional = DEMO_CATALOG.professionals.find((item) => item.id === input.professionalId);

    if (!service || !professional) {
      throw new RepositoryNotFoundError("CATALOG_ITEM_NOT_FOUND");
    }

    const appointment: AppointmentRecord = {
      id: randomUUID(),
      confirmationCode: confirmationCode(),
      idempotencyKey: input.idempotencyKey,
      clinicId: input.clinicId,
      serviceId: input.serviceId,
      serviceName: service.name,
      professionalId: input.professionalId,
      professionalName: professional.name,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      patientName: input.patientName,
      patientWhatsapp: input.patientWhatsapp,
      status: "confirmed",
      source: input.source,
      createdAt: new Date().toISOString(),
      cancelledAt: null,
    };

    state.appointments.push(appointment);
    return { appointment: { ...appointment }, replayed: false };
  }

  async cancelAppointment(id: string) {
    const appointment = state.appointments.find((item) => item.id === id);

    if (!appointment) {
      throw new RepositoryNotFoundError("APPOINTMENT_NOT_FOUND");
    }

    appointment.status = "cancelled";
    appointment.cancelledAt = new Date().toISOString();
    return { ...appointment };
  }

  async consumeRateLimit(keyHash: string, windowSeconds: number, maximum: number) {
    const now = Date.now();
    const current = state.rateLimits.get(keyHash);

    if (!current || current.resetAt <= now) {
      state.rateLimits.set(keyHash, { count: 1, resetAt: now + windowSeconds * 1000 });
      return true;
    }

    current.count += 1;
    return current.count <= maximum;
  }

  async health() {
    return { storage: "memory" as const, ok: true };
  }
}

export const memoryClinicRepository = new MemoryClinicRepository();

export function resetMemoryRepositoryForTests() {
  state.appointments.splice(0, state.appointments.length);
  state.rateLimits.clear();
}
