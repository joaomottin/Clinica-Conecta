import { NextResponse } from "next/server";

export function GET() {
  const serverUrl = process.env.SITE_URL || "http://localhost:3000";
  const document = {
    openapi: "3.1.0",
    info: {
      title: "Clínica WebMCP Campo Largo — API de demonstração",
      version: "0.1.0",
      description: "Documentação técnica do MVP fictício. A descoberta automática pelo ChatGPT ocorre pelas Site Tools registradas em JavaScript, não por este arquivo.",
    },
    servers: [{ url: serverUrl }],
    paths: {
      "/api/clinic": {
        get: {
          operationId: "obterDadosClinica",
          summary: "Obtém a clínica e seus serviços ativos",
          responses: {
            "200": { description: "Catálogo da clínica fictícia", content: { "application/json": { schema: { $ref: "#/components/schemas/ClinicResponse" } } } },
            "503": { $ref: "#/components/responses/ServiceUnavailable" },
          },
        },
      },
      "/api/availability": {
        get: {
          operationId: "buscarHorarios",
          summary: "Busca horários disponíveis e tokens assinados",
          parameters: [
            { name: "servico", in: "query", schema: { type: "string", enum: ["clinica-geral"], default: "clinica-geral" } },
            { name: "data_inicial", in: "query", required: true, schema: { type: "string", format: "date" } },
            { name: "periodo", in: "query", schema: { type: "string", enum: ["manha", "tarde", "qualquer"], default: "qualquer" } },
            { name: "quantidade", in: "query", schema: { type: "integer", minimum: 1, maximum: 10, default: 5 } },
            { name: "dias", in: "query", schema: { type: "integer", minimum: 1, maximum: 14, default: 14 } },
          ],
          responses: {
            "200": { description: "Horários disponíveis", content: { "application/json": { schema: { $ref: "#/components/schemas/AvailabilityResponse" } } } },
            "400": { $ref: "#/components/responses/BadRequest" },
            "503": { $ref: "#/components/responses/ServiceUnavailable" },
          },
        },
      },
      "/api/appointments": {
        post: {
          operationId: "agendarConsulta",
          summary: "Cria um agendamento fictício após confirmação explícita",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/BookingRequest" } } } },
          responses: {
            "201": { description: "Agendamento criado", content: { "application/json": { schema: { $ref: "#/components/schemas/BookingResponse" } } } },
            "200": { description: "Repetição idempotente do mesmo agendamento" },
            "400": { $ref: "#/components/responses/BadRequest" },
            "409": { description: "Horário ocupado" },
            "429": { description: "Limite de tentativas atingido" },
          },
        },
      },
      "/api/admin/appointments": {
        get: {
          operationId: "listarAgendamentosAdmin",
          summary: "Lista agendamentos com sessão administrativa",
          security: [{ adminCookie: [] }],
          responses: {
            "200": { description: "Lista administrativa" },
            "401": { description: "Sessão necessária" },
            "503": { $ref: "#/components/responses/ServiceUnavailable" },
          },
        },
      },
      "/api/admin/appointments/{id}/cancel": {
        post: {
          operationId: "cancelarAgendamentoAdmin",
          summary: "Cancela um agendamento fictício",
          security: [{ adminCookie: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Agendamento cancelado" }, "401": { description: "Sessão necessária" }, "404": { description: "Agendamento não encontrado" } },
        },
      },
    },
    components: {
      securitySchemes: { adminCookie: { type: "apiKey", in: "cookie", name: "clinic_admin_session" } },
      responses: {
        BadRequest: { description: "Dados inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        ServiceUnavailable: { description: "Leitura do banco temporariamente indisponível após novas tentativas", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: { error: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } } },
        },
        ClinicResponse: {
          type: "object",
          properties: {
            clinic: { type: "object", properties: { name: { type: "string" }, city: { type: "string" }, state: { type: "string" }, timezone: { type: "string" }, isDemo: { type: "boolean" } } },
            services: { type: "array", items: { type: "object", properties: { id: { type: "string", format: "uuid" }, name: { type: "string" }, slug: { type: "string" }, durationMinutes: { type: "integer" } } } },
            notice: { type: "string" },
          },
        },
        AvailabilityResponse: {
          type: "object",
          properties: {
            service: { type: "string" },
            slots: { type: "array", items: { type: "object", required: ["startsAt", "endsAt", "label", "slotToken"], properties: { startsAt: { type: "string", format: "date-time" }, endsAt: { type: "string", format: "date-time" }, label: { type: "string" }, dateLabel: { type: "string" }, professionalName: { type: "string" }, slotToken: { type: "string" } } } },
            notice: { type: "string" },
          },
        },
        BookingRequest: {
          type: "object",
          required: ["slot_token", "nome_paciente", "whatsapp", "confirmacao_explicita", "consentimento_demo"],
          properties: {
            slot_token: { type: "string" },
            nome_paciente: { type: "string", minLength: 3, maxLength: 80 },
            whatsapp: { type: "string" },
            confirmacao_explicita: { type: "boolean", const: true },
            consentimento_demo: { type: "boolean", const: true },
            origem: { type: "string", enum: ["web", "webmcp"] },
          },
        },
        BookingResponse: {
          type: "object",
          properties: { status: { type: "string", const: "confirmed" }, replayed: { type: "boolean" }, confirmationCode: { type: "string" }, appointment: { type: "object" }, notice: { type: "string" } },
        },
      },
    },
  };

  return NextResponse.json(document, {
    headers: { "cache-control": "public, max-age=300" },
  });
}
