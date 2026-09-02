"use client";

import { useEffect, useState } from "react";
import { Bot, CheckCircle2, Globe2 } from "lucide-react";

import { fetchReadWithRetry } from "@/lib/fetch-read-with-retry";

type RegistrationState = "checking" | "ready" | "fallback" | "error";

declare global {
  interface Document {
    __clinicWebMcpRegistered?: boolean;
  }
}

async function fetchJson(path: string, init?: RequestInit) {
  const method = (init?.method ?? "GET").toUpperCase();
  const response = method === "GET"
    ? await fetchReadWithRetry(path, { ...init, cache: "no-store" })
    : await fetch(path, init);
  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message;
    throw new Error(typeof message === "string" ? message : "A operação da clínica falhou.");
  }
  return payload;
}

async function registerClinicTools() {
  const registerTool = document.modelContext?.registerTool;
  if (typeof registerTool !== "function") return false;
  if (document.__clinicWebMcpRegistered) return true;
  document.__clinicWebMcpRegistered = true;

  await registerTool.call(document.modelContext, {
    name: "obter_dados_clinica",
    description: "Consulta os dados da Clínica WebMCP Campo Largo, seus serviços e o aviso obrigatório de que este é um ambiente fictício sem atendimento médico.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: async () => fetchJson("/api/clinic"),
  });

  await registerTool.call(document.modelContext, {
    name: "buscar_horarios",
    description: "Busca horários fictícios disponíveis para Clínica Geral nos próximos 14 dias. Retorna horários legíveis e tokens opacos válidos por 10 minutos; nunca invente nem altere um token.",
    inputSchema: {
      type: "object",
      properties: {
        servico: { type: "string", enum: ["clinica-geral"], description: "Use clinica-geral." },
        data_inicial: { type: "string", format: "date", description: "Primeiro dia da busca, em AAAA-MM-DD no fuso de São Paulo." },
        periodo: { type: "string", enum: ["manha", "tarde", "qualquer"], description: "Período desejado." },
        quantidade: { type: "integer", minimum: 1, maximum: 10, description: "Máximo de horários a retornar." },
      },
      required: ["data_inicial"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const query = new URLSearchParams({
        servico: typeof input.servico === "string" ? input.servico : "clinica-geral",
        data_inicial: String(input.data_inicial ?? ""),
        periodo: typeof input.periodo === "string" ? input.periodo : "qualquer",
        quantidade: String(input.quantidade ?? 5),
        dias: "14",
      });
      return fetchJson(`/api/availability?${query}`);
    },
  });

  await registerTool.call(document.modelContext, {
    name: "agendar_consulta",
    description: "Cria um agendamento fictício. Antes de chamar esta ferramenta, mostre ao usuário o serviço, profissional, data, hora, nome e WhatsApp fictícios e espere uma resposta explícita como “Confirmo”. Nunca chame com confirmacao_explicita=true sem essa resposta. Não use dados pessoais ou clínicos verdadeiros.",
    inputSchema: {
      type: "object",
      properties: {
        slot_token: { type: "string", description: "Token opaco retornado por buscar_horarios." },
        nome_paciente: { type: "string", minLength: 3, maxLength: 80, description: "Nome exclusivamente fictício." },
        whatsapp: { type: "string", minLength: 10, maxLength: 24, description: "WhatsApp brasileiro exclusivamente fictício, com DDD." },
        confirmacao_explicita: { type: "boolean", description: "Somente true após o usuário confirmar o resumo de forma explícita." },
      },
      required: ["slot_token", "nome_paciente", "whatsapp", "confirmacao_explicita"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute: async (input) => fetchJson("/api/appointments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slot_token: input.slot_token,
        nome_paciente: input.nome_paciente,
        whatsapp: input.whatsapp,
        confirmacao_explicita: input.confirmacao_explicita,
        consentimento_demo: true,
        origem: "webmcp",
      }),
    }),
  });

  return true;
}

export function WebMcpRegistrar() {
  const [state, setState] = useState<RegistrationState>("checking");

  useEffect(() => {
    let active = true;
    registerClinicTools()
      .then((supported) => active && setState(supported ? "ready" : "fallback"))
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, []);

  const ready = state === "ready";
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-foreground/8 bg-card/75 px-3 py-1.5 text-xs text-muted-foreground" data-webmcp-state={state} title={ready ? "Três Site Tools registradas" : "O formulário continua funcionando sem WebMCP"}>
      {ready ? <CheckCircle2 className="size-3.5 text-primary" /> : state === "checking" ? <Bot className="size-3.5 text-primary" /> : <Globe2 className="size-3.5 text-primary" />}
      {ready ? "3 Site Tools disponíveis" : state === "checking" ? "Verificando Site Tools…" : state === "error" ? "Site Tools indisponíveis" : "Formulário web ativo"}
    </div>
  );
}
