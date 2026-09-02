"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  CircleAlert,
  Clock3,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Slot = {
  startsAt: string;
  endsAt: string;
  label: string;
  dateLabel: string;
  professionalName: string;
  serviceName: string;
  slotToken: string;
};

type AvailabilityResponse = {
  slots: Slot[];
  notice: string;
};

type SuccessResponse = {
  replayed: boolean;
  confirmationCode: string;
  appointment: {
    service: string;
    professional: string;
    startsAt: string;
    endsAt: string;
  };
  notice: string;
};

type FlowStep = "search" | "contact" | "review" | "success";

function getErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return fallback;
}

function formatAppointment(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

export function BookingFlow({ minDate, maxDate, defaultDate }: { minDate: string; maxDate: string; defaultDate: string }) {
  const [step, setStep] = useState<FlowStep>("search");
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [period, setPeriod] = useState("tarde");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [patientName, setPatientName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [success, setSuccess] = useState<SuccessResponse | null>(null);

  const stepNumber = step === "search" ? 1 : step === "contact" ? 2 : 3;
  const title = step === "success" ? "Consulta demonstrativa agendada" : "Agendar consulta";
  const summary = useMemo(() => (selectedSlot ? formatAppointment(selectedSlot.startsAt) : ""), [selectedSlot]);

  async function searchAvailability() {
    setLoading(true);
    setError("");
    setSearched(false);
    setSlots([]);
    setSelectedSlot(null);

    try {
      const query = new URLSearchParams({
        servico: "clinica-geral",
        data_inicial: selectedDate,
        periodo: period,
        quantidade: "10",
        dias: "1",
      });
      const response = await fetch(`/api/availability?${query}`);
      const payload = (await response.json()) as AvailabilityResponse;

      if (!response.ok) throw new Error(getErrorMessage(payload, "Não foi possível consultar a agenda."));
      setSlots(payload.slots);
      setSearched(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível consultar a agenda.");
    } finally {
      setLoading(false);
    }
  }

  function continueToReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (patientName.trim().length < 3) {
      setError("Informe um nome fictício com pelo menos 3 caracteres.");
      return;
    }
    const digits = whatsapp.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) {
      setError("Informe um WhatsApp fictício com DDD.");
      return;
    }
    if (!consent) {
      setError("Aceite o aviso de demonstração para continuar.");
      return;
    }
    setStep("review");
  }

  async function confirmBooking() {
    if (!selectedSlot) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slot_token: selectedSlot.slotToken,
          nome_paciente: patientName,
          whatsapp,
          confirmacao_explicita: true,
          consentimento_demo: consent,
          origem: "web",
        }),
      });
      const payload = (await response.json()) as SuccessResponse;

      if (!response.ok) {
        if (response.status === 409) setStep("search");
        throw new Error(getErrorMessage(payload, "Não foi possível criar o agendamento."));
      }

      setSuccess(payload);
      setStep("success");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível criar o agendamento.");
    } finally {
      setLoading(false);
    }
  }

  function resetFlow() {
    setStep("search");
    setSlots([]);
    setSelectedSlot(null);
    setPatientName("");
    setWhatsapp("");
    setConsent(false);
    setError("");
    setSearched(false);
    setSuccess(null);
  }

  return (
    <Card className="booking-card gap-0 rounded-[1.75rem] border-0 py-0 shadow-[0_30px_90px_-45px_rgba(14,61,54,0.45)] ring-1 ring-foreground/8">
      <CardHeader className="border-b border-foreground/8 px-5 py-5 sm:px-7 sm:py-6">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-medium text-primary">
            <span className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
              {step === "success" ? <Check className="size-3.5" /> : stepNumber}
            </span>
            {step === "success" ? "Concluído" : step === "search" ? "Escolha o horário" : step === "contact" ? "Dados fictícios" : "Revise e confirme"}
          </div>
          <span className="text-xs text-muted-foreground">{step === "success" ? "Demonstração" : `Etapa ${stepNumber} de 3`}</span>
        </div>
        <CardTitle className="text-xl font-semibold tracking-[-0.03em]">{title}</CardTitle>
        <CardDescription className="leading-6">
          {step === "success" ? "Guarde o código apenas para conferir o teste no painel." : "Clínica Geral com Profissional de Demonstração"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 px-5 py-6 sm:px-7 sm:py-7">
        {step !== "success" && (
          <div className="rounded-2xl border border-primary/12 bg-primary/[0.055] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Check className="size-4" aria-hidden="true" />
              Consulta de Clínica Geral
            </div>
            <p className="mt-1 pl-6 text-xs text-muted-foreground">30 minutos · demonstração</p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/7 p-3 text-sm text-destructive" role="alert">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {step === "search" && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="booking-date">Data</Label>
                <Input
                  className="h-11 rounded-xl bg-card"
                  id="booking-date"
                  max={maxDate}
                  min={minDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setSearched(false);
                    setSlots([]);
                  }}
                  type="date"
                  value={selectedDate}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodo">Período</Label>
                <Select
                  value={period}
                  onValueChange={(value) => {
                    if (!value) return;
                    setPeriod(value);
                    setSearched(false);
                    setSlots([]);
                  }}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl bg-card" id="periodo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manha">Manhã · 09h às 12h</SelectItem>
                    <SelectItem value="tarde">Tarde · 14h às 17h</SelectItem>
                    <SelectItem value="qualquer">Qualquer período</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button className="h-12 w-full rounded-xl text-sm shadow-[0_16px_34px_-18px_var(--primary)]" disabled={loading || !selectedDate} onClick={searchAvailability} size="lg">
              {loading ? <LoaderCircle className="animate-spin" /> : <Clock3 />}
              {loading ? "Consultando agenda…" : "Ver horários disponíveis"}
            </Button>

            {searched && slots.length === 0 && (
              <div className="rounded-xl border border-border bg-muted/45 p-4 text-sm leading-6 text-muted-foreground" role="status">
                Não há horários nesse dia e período. Escolha outra data ou período.
              </div>
            )}

            {slots.length > 0 && (
              <fieldset>
                <legend className="mb-3 text-sm font-semibold">Horários disponíveis</legend>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => (
                    <button
                      className={cn(
                        "min-h-11 rounded-xl border bg-card px-2 py-2 text-sm font-semibold transition hover:border-primary hover:bg-primary/[0.05] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        selectedSlot?.slotToken === slot.slotToken && "border-primary bg-primary text-primary-foreground hover:bg-primary",
                      )}
                      key={slot.slotToken}
                      onClick={() => {
                        setSelectedSlot(slot);
                        setStep("contact");
                        setError("");
                      }}
                      type="button"
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Tokens dos horários expiram em 10 minutos.</p>
              </fieldset>
            )}
          </div>
        )}

        {step === "contact" && selectedSlot && (
          <form className="space-y-5" onSubmit={continueToReview}>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-sm">
              <CalendarCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="font-semibold capitalize">{summary}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{selectedSlot.professionalName}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-name">Nome fictício</Label>
              <Input autoComplete="off" className="h-11 rounded-xl bg-card" id="patient-name" maxLength={80} onChange={(event) => setPatientName(event.target.value)} placeholder="Ex.: Paciente Teste" required value={patientName} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-whatsapp">WhatsApp fictício</Label>
              <Input autoComplete="off" className="h-11 rounded-xl bg-card" id="patient-whatsapp" inputMode="tel" maxLength={24} onChange={(event) => setWhatsapp(event.target.value)} placeholder="Ex.: (41) 99999-0000" required value={whatsapp} />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300/55 bg-amber-50/75 p-4 text-sm leading-5 text-amber-950">
              <Checkbox checked={consent} className="mt-0.5" onCheckedChange={(checked) => setConsent(Boolean(checked))} />
              <span>Confirmo que este é um teste e usarei apenas nome e telefone fictícios, sem dados pessoais ou clínicos verdadeiros.</span>
            </label>

            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Button className="h-12 rounded-xl" onClick={() => setStep("search")} type="button" variant="outline">
                <ArrowLeft /> Voltar
              </Button>
              <Button className="h-12 rounded-xl" type="submit">
                Revisar agendamento <ArrowRight />
              </Button>
            </div>
          </form>
        )}

        {step === "review" && selectedSlot && (
          <div className="space-y-5">
            <div className="divide-y divide-border rounded-2xl border border-border bg-card px-4">
              <div className="py-3">
                <p className="text-xs text-muted-foreground">Quando</p>
                <p className="mt-1 text-sm font-semibold capitalize">{summary}</p>
              </div>
              <div className="py-3">
                <p className="text-xs text-muted-foreground">Paciente fictício</p>
                <p className="mt-1 text-sm font-semibold">{patientName}</p>
                <p className="text-xs text-muted-foreground">{whatsapp}</p>
              </div>
              <div className="py-3">
                <p className="text-xs text-muted-foreground">Atendimento</p>
                <p className="mt-1 text-sm font-semibold">Consulta de Clínica Geral · 30 min</p>
                <p className="text-xs text-muted-foreground">{selectedSlot.professionalName}</p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-primary/[0.06] p-3 text-xs leading-5 text-primary">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <p>Nada foi gravado ainda. O agendamento só será criado ao clicar em “Confirmar demonstração”.</p>
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Button className="h-12 rounded-xl" disabled={loading} onClick={() => setStep("contact")} variant="outline">
                <ArrowLeft /> Corrigir
              </Button>
              <Button className="h-12 rounded-xl" disabled={loading} onClick={confirmBooking}>
                {loading ? <LoaderCircle className="animate-spin" /> : <Check />}
                {loading ? "Confirmando…" : "Confirmar demonstração"}
              </Button>
            </div>
          </div>
        )}

        {step === "success" && success && (
          <div className="space-y-5 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
              <CalendarCheck className="size-8" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Código de confirmação</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-[0.08em] text-primary" data-testid="confirmation-code">{success.confirmationCode}</p>
              {success.replayed && <p className="mt-2 text-xs text-muted-foreground">Requisição repetida reconhecida; nenhum agendamento foi duplicado.</p>}
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 text-left text-sm">
              <p className="font-semibold capitalize">{formatAppointment(success.appointment.startsAt)}</p>
              <p className="mt-1 text-muted-foreground">{success.appointment.service}</p>
              <p className="text-muted-foreground">{success.appointment.professional}</p>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">Agendamento fictício: não há atendimento, cobrança ou envio de mensagem.</p>
            <Button className="h-11 w-full rounded-xl" onClick={resetFlow} variant="outline">
              <RotateCcw /> Fazer outro teste
            </Button>
          </div>
        )}

        {step === "search" && (
          <div className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            O mesmo fluxo é exposto ao ChatGPT por três Site Tools
          </div>
        )}

        <span className="sr-only" aria-live="polite">{loading ? "Carregando" : error || (success ? "Agendamento concluído" : "")}</span>
      </CardContent>
    </Card>
  );
}
