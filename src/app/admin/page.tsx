import Link from "next/link";
import { ArrowLeft, ShieldCheck, Stethoscope } from "lucide-react";

import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminLogin } from "@/components/admin-login";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listAdminAppointments } from "@/lib/clinic/service";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authenticated = await isAdminAuthenticated();
  const appointments = authenticated ? await listAdminAppointments() : [];

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-foreground/8 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link className="flex items-center gap-3" href="/">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Stethoscope className="size-4" /></span>
            <span><span className="block text-sm font-semibold">Clínica WebMCP</span><span className="block text-xs text-muted-foreground">Painel de demonstração</span></span>
          </Link>
          <Link className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary" href="/"><ArrowLeft className="size-4" /> Voltar ao site</Link>
        </div>
      </header>

      <section className={authenticated ? "mx-auto flex max-w-6xl px-5 py-8 sm:px-8" : "mx-auto grid min-h-[calc(100vh-74px)] place-items-center px-5 py-10"}>
        {authenticated ? <AdminDashboard initialAppointments={appointments} /> : <AdminLogin />}
      </section>

      <div className="fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-300/55 bg-amber-50 px-3 py-1.5 text-xs text-amber-950 shadow-sm">
        <ShieldCheck className="size-3.5" /> Apenas dados fictícios
      </div>
    </main>
  );
}
