"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarDays, LoaderCircle, LogOut, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AppointmentRecord } from "@/lib/clinic/types";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

function sourceLabel(source: AppointmentRecord["source"]) {
  return source === "webmcp" ? "WebMCP" : source === "web" ? "Site" : "Admin";
}

export function AdminDashboard({ initialAppointments }: { initialAppointments: AppointmentRecord[] }) {
  const router = useRouter();
  const [appointments, setAppointments] = useState(initialAppointments);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function cancelAppointment(appointment: AppointmentRecord) {
    if (!window.confirm(`Cancelar o agendamento ${appointment.confirmationCode}? O horário voltará a ficar disponível.`)) return;
    setPendingId(appointment.id);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/appointments/${appointment.id}/cancel`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? "Não foi possível cancelar.");
      setAppointments((current) => current.map((item) => (item.id === appointment.id ? payload.appointment : item)));
      setMessage(`Agendamento ${appointment.confirmationCode} cancelado. O horário foi liberado.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Não foi possível cancelar.");
    } finally {
      setPendingId(null);
    }
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="w-full max-w-6xl space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge className="mb-3 border-primary/15 bg-primary/8 text-primary" variant="outline">Demonstração</Badge>
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.04em]">Agendamentos</h1>
          <p className="mt-2 text-sm text-muted-foreground">Confira a origem do teste e libere horários cancelando consultas fictícias.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.refresh()} variant="outline"><RefreshCw /> Atualizar</Button>
          <Button onClick={logout} variant="outline"><LogOut /> Sair</Button>
        </div>
      </div>

      {message && <p className="rounded-xl border border-border bg-card p-3 text-sm" role="status">{message}</p>}

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b border-border py-5">
          <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="size-4 text-primary" /> {appointments.length} registro{appointments.length === 1 ? "" : "s"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {appointments.length === 0 ? (
            <div className="grid min-h-52 place-items-center p-8 text-center">
              <div>
                <CalendarDays className="mx-auto size-8 text-primary/55" />
                <p className="mt-3 font-semibold">Nenhum agendamento ainda</p>
                <p className="mt-1 text-sm text-muted-foreground">Faça um teste pelo site ou pelo ChatGPT.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Data e hora</TableHead>
                      <TableHead>Paciente fictício</TableHead>
                      <TableHead>Profissional</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((appointment) => (
                      <TableRow key={appointment.id}>
                        <TableCell className="font-mono font-semibold">{appointment.confirmationCode}</TableCell>
                        <TableCell>{formatDate(appointment.startsAt)}</TableCell>
                        <TableCell><span className="font-medium">{appointment.patientName}</span><br /><span className="text-xs text-muted-foreground">{appointment.patientWhatsapp}</span></TableCell>
                        <TableCell>{appointment.professionalName}</TableCell>
                        <TableCell><Badge variant="outline">{sourceLabel(appointment.source)}</Badge></TableCell>
                        <TableCell><Badge className={appointment.status === "confirmed" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}>{appointment.status === "confirmed" ? "Confirmado" : "Cancelado"}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button disabled={appointment.status === "cancelled" || pendingId === appointment.id} onClick={() => cancelAppointment(appointment)} size="sm" variant="destructive">
                            {pendingId === appointment.id ? <LoaderCircle className="animate-spin" /> : <Ban />} Cancelar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="divide-y divide-border md:hidden">
                {appointments.map((appointment) => (
                  <article className="space-y-3 p-5" key={appointment.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-mono text-sm font-bold">{appointment.confirmationCode}</p><p className="mt-1 text-sm font-semibold">{formatDate(appointment.startsAt)}</p></div>
                      <Badge variant="outline">{sourceLabel(appointment.source)}</Badge>
                    </div>
                    <div className="text-sm"><p>{appointment.patientName}</p><p className="text-xs text-muted-foreground">{appointment.patientWhatsapp} · {appointment.professionalName}</p></div>
                    <div className="flex items-center justify-between gap-3">
                      <Badge className={appointment.status === "confirmed" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}>{appointment.status === "confirmed" ? "Confirmado" : "Cancelado"}</Badge>
                      <Button disabled={appointment.status === "cancelled" || pendingId === appointment.id} onClick={() => cancelAppointment(appointment)} size="sm" variant="destructive">{pendingId === appointment.id ? <LoaderCircle className="animate-spin" /> : <Ban />} Cancelar</Button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
