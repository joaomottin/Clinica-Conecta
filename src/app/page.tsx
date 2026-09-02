import { Bot, CalendarDays, Clock3, MapPin, ShieldCheck, Stethoscope } from "lucide-react";
import { addDays } from "date-fns";

import { BookingFlow } from "@/components/booking-flow";
import { Badge } from "@/components/ui/badge";
import { WebMcpRegistrar } from "@/components/webmcp-registrar";
import { todayInTimeZone } from "@/lib/clinic/availability";

export const dynamic = "force-dynamic";

function addCalendarDays(date: string, amount: number) {
  return addDays(new Date(`${date}T12:00:00.000Z`), amount).toISOString().slice(0, 10);
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <div aria-hidden="true" className="ambient ambient-one" />
      <div aria-hidden="true" className="ambient ambient-two" />

      <header className="relative z-10 border-b border-foreground/8 bg-background/82 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)]">
              <Stethoscope className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-heading text-sm font-semibold tracking-[-0.02em] sm:text-base">
                Clínica WebMCP
              </p>
              <p className="text-xs text-muted-foreground">Campo Largo · PR</p>
            </div>
          </div>
          <Badge className="border-amber-300/70 bg-amber-50 text-amber-900" variant="outline">
            Ambiente de demonstração
          </Badge>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:grid-rows-[auto_auto] lg:items-start lg:gap-x-10 lg:gap-y-0 lg:py-16">
        <div className="max-w-xl">
          <Badge className="mb-5 border-primary/15 bg-primary/8 text-primary" variant="outline">
            <Bot data-icon="inline-start" />
            Pronta para conversar com o ChatGPT
          </Badge>
          <h1 className="font-heading text-4xl font-semibold leading-[1.04] tracking-[-0.055em] text-balance sm:text-5xl lg:text-[3.6rem]">
            Uma consulta marcada em poucos passos — ou em uma conversa.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
            Escolha um horário nesta página ou peça ao ChatGPT para consultar a agenda enquanto o site estiver aberto.
          </p>
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
          <BookingFlow
            defaultDate={addCalendarDays(todayInTimeZone("America/Sao_Paulo"), 1)}
            maxDate={addCalendarDays(todayInTimeZone("America/Sao_Paulo"), 14)}
            minDate={todayInTimeZone("America/Sao_Paulo")}
          />
        </div>

        <div className="max-w-xl lg:col-start-1 lg:row-start-2">
          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="fact-card">
              <CalendarDays aria-hidden="true" />
              <span>Próximos 14 dias</span>
            </div>
            <div className="fact-card">
              <Clock3 aria-hidden="true" />
              <span>Consultas de 30 min</span>
            </div>
            <div className="fact-card">
              <MapPin aria-hidden="true" />
              <span>Campo Largo · PR</span>
            </div>
          </div>

          <div className="mt-7 flex items-start gap-3 rounded-2xl border border-amber-300/50 bg-amber-50/75 p-4 text-sm leading-6 text-amber-950">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
            <p>
              Esta clínica é fictícia. Não há atendimento médico e nenhum dado pessoal ou clínico verdadeiro deve ser informado.
            </p>
          </div>
          <div className="mt-4">
            <WebMcpRegistrar />
          </div>
        </div>
      </section>

      <footer className="relative z-10 mx-auto flex max-w-6xl flex-col gap-2 border-t border-foreground/8 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>Clínica WebMCP Campo Largo — demonstração técnica sem atendimento real.</p>
        <a className="font-medium text-foreground/75 hover:text-primary" href="/admin">
          Acesso administrativo
        </a>
      </footer>
    </main>
  );
}
