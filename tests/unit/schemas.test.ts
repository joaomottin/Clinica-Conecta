import { describe, expect, it } from "vitest";

import { availabilityQuerySchema, bookingRequestSchema, normalizeBrazilianWhatsapp } from "@/lib/clinic/schemas";

describe("schemas públicos", () => {
  it("normaliza telefones brasileiros sem armazenar pontuação", () => {
    expect(normalizeBrazilianWhatsapp("(41) 99999-0000")).toBe("+5541999990000");
    expect(normalizeBrazilianWhatsapp("+55 41 3333-0000")).toBe("+554133330000");
    expect(() => normalizeBrazilianWhatsapp("123")).toThrow(/WhatsApp fictício/);
  });

  it("rejeita uma escrita sem confirmação e consentimento explícitos", () => {
    const parsed = bookingRequestSchema.safeParse({
      slot_token: "token-com-tamanho-suficiente",
      nome_paciente: "Paciente Teste",
      whatsapp: "41999990000",
      confirmacao_explicita: false,
      consentimento_demo: true,
      origem: "webmcp",
    });
    expect(parsed.success).toBe(false);
  });

  it("limita datas, períodos e quantidades da consulta", () => {
    expect(availabilityQuerySchema.safeParse({ data_inicial: "01/09/2026" }).success).toBe(false);
    expect(availabilityQuerySchema.safeParse({ data_inicial: "2026-09-01", periodo: "noite" }).success).toBe(false);
    expect(availabilityQuerySchema.parse({ data_inicial: "2026-09-01" }).quantidade).toBe(5);
  });
});
