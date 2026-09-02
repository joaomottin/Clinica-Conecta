import { z } from "zod";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export const availabilityQuerySchema = z.object({
  servico: z.string().trim().min(1).default("clinica-geral"),
  data_inicial: z.string().regex(isoDate, "Use a data no formato AAAA-MM-DD."),
  periodo: z.enum(["manha", "tarde", "qualquer"]).default("qualquer"),
  quantidade: z.coerce.number().int().min(1).max(10).default(5),
  dias: z.coerce.number().int().min(1).max(14).default(14),
});

export const bookingRequestSchema = z.object({
  slot_token: z.string().min(20, "Token de horário inválido."),
  nome_paciente: z.string().trim().min(3).max(80),
  whatsapp: z.string().trim().min(10).max(24),
  confirmacao_explicita: z.literal(true, {
    error: "A confirmação explícita é obrigatória antes de agendar.",
  }),
  consentimento_demo: z.literal(true, {
    error: "Confirme que serão usados apenas dados fictícios.",
  }),
  origem: z.enum(["web", "webmcp"]).default("web"),
});

export const adminLoginSchema = z.object({
  password: z.string().min(1).max(200),
});

export function normalizeBrazilianWhatsapp(input: string) {
  let digits = input.replace(/\D/g, "");

  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }

  if (digits.length !== 10 && digits.length !== 11) {
    throw new Error("Informe um WhatsApp fictício com DDD e 10 ou 11 dígitos.");
  }

  return `+55${digits}`;
}

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type BookingRequest = z.infer<typeof bookingRequestSchema>;
