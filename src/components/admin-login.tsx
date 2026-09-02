"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? "Não foi possível entrar.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md gap-0 rounded-[1.75rem] border-0 py-0 shadow-[0_30px_90px_-45px_rgba(14,61,54,0.45)] ring-1 ring-foreground/8">
      <CardHeader className="border-b border-foreground/8 px-6 py-6">
        <div className="mb-3 grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
          <KeyRound className="size-5" />
        </div>
        <CardTitle className="text-xl">Painel administrativo</CardTitle>
        <CardDescription>Entre com a senha configurada no servidor.</CardDescription>
      </CardHeader>
      <CardContent className="px-6 py-6">
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="admin-password">Senha</Label>
            <Input autoComplete="current-password" className="h-11 rounded-xl" id="admin-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </div>
          {error && <p className="rounded-xl bg-destructive/8 p-3 text-sm text-destructive" role="alert">{error}</p>}
          <Button className="h-11 w-full rounded-xl" disabled={loading} type="submit">
            {loading ? <LoaderCircle className="animate-spin" /> : <LogIn />}
            {loading ? "Entrando…" : "Entrar"}
          </Button>
          {process.env.NODE_ENV !== "production" && (
            <p className="text-center text-xs text-muted-foreground">No ambiente local sem .env, use <code className="font-mono">demo-admin</code>.</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
