import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import type { AvailabilitySlot } from "@/lib/clinic/types";

const slotPayloadSchema = z.object({
  v: z.literal(1),
  clinicId: z.string().uuid(),
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  expiresAt: z.number().int().positive(),
});

export type SlotPayload = z.infer<typeof slotPayloadSchema>;

function signingSecret() {
  const configured = process.env.APP_SIGNING_SECRET;

  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error("APP_SIGNING_SECRET não está configurado.");
  }

  return "clinic-webmcp-local-development-secret-change-me";
}

function sign(value: string) {
  return createHmac("sha256", signingSecret()).update(value).digest("base64url");
}

export function createSlotToken(slot: AvailabilitySlot, now = new Date()) {
  const payload: SlotPayload = {
    v: 1,
    clinicId: slot.clinicId,
    serviceId: slot.serviceId,
    professionalId: slot.professionalId,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    expiresAt: now.getTime() + 10 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${encoded}.${sign(encoded)}`;
}

export function verifySlotToken(token: string, now = new Date()): SlotPayload {
  const [encoded, signature] = token.split(".");

  if (!encoded || !signature) {
    throw new Error("Token de horário inválido.");
  }

  const expected = Buffer.from(sign(encoded));
  const received = Buffer.from(signature);

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error("Token de horário adulterado.");
  }

  const parsed = slotPayloadSchema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));

  if (parsed.expiresAt < now.getTime()) {
    throw new Error("Este horário expirou. Consulte a disponibilidade novamente.");
  }

  return parsed;
}

export function keyedHash(value: string, namespace: string) {
  return createHmac("sha256", signingSecret()).update(`${namespace}:${value}`).digest("hex");
}
