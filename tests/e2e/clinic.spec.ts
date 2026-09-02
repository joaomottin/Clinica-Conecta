import { expect, test } from "@playwright/test";

function nextWeekdayDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const today = `${map.year}-${map.month}-${map.day}`;
  for (let offset = 1; offset <= 7; offset += 1) {
    const date = new Date(`${today}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    if (date.getUTCDay() >= 1 && date.getUTCDay() <= 5) return date.toISOString().slice(0, 10);
  }
  throw new Error("Nenhum dia útil encontrado.");
}

test.describe("MVP da clínica", () => {
  test("registra exatamente três Site Tools com nomes estáveis", async ({ page }) => {
    await page.addInitScript(() => {
      const tools: Array<{ name: string }> = [];
      Object.defineProperty(document, "modelContext", {
        configurable: true,
        value: { registerTool: async (tool: { name: string }) => { tools.push(tool); } },
      });
      (window as typeof window & { __capturedSiteTools: Array<{ name: string }> }).__capturedSiteTools = tools;
    });
    await page.goto("/");
    await expect(page.locator('[data-webmcp-state="ready"]')).toContainText("3 Site Tools");
    const names = await page.evaluate(() => (window as typeof window & { __capturedSiteTools: Array<{ name: string }> }).__capturedSiteTools.map((tool) => tool.name));
    expect(names).toEqual(["obter_dados_clinica", "buscar_horarios", "agendar_consulta"]);
  });

  test("agenda pelo formulário, confere no admin, cancela e libera o horário", async ({ page, request, isMobile }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Uma consulta marcada/ })).toBeVisible();
    await page.locator("#booking-date").fill(nextWeekdayDate());
    await page.getByRole("button", { name: "Ver horários disponíveis" }).click();
    await expect(page.getByText("Horários disponíveis", { exact: true })).toBeVisible();
    const slotButton = page.locator("fieldset button").first();
    const bookedTime = await slotButton.textContent();
    await slotButton.click();
    await page.getByLabel("Nome fictício").fill("Paciente Teste E2E");
    await page.getByLabel("WhatsApp fictício").fill("(41) 99999-0003");
    await page.getByText(/Confirmo que este é um teste/).click();
    await page.getByRole("button", { name: "Revisar agendamento" }).click();
    await expect(page.getByText(/Nada foi gravado ainda/)).toBeVisible();
    await expect(page.getByTestId("confirmation-code")).toHaveCount(0);
    await page.getByRole("button", { name: "Confirmar demonstração" }).click();
    const code = await page.getByTestId("confirmation-code").textContent();
    expect(code).toMatch(/^CL-[A-F0-9]{8}$/);

    const unauthorized = await request.get("/api/admin/appointments");
    expect(unauthorized.status()).toBe(401);

    await page.goto("/admin");
    await page.getByLabel("Senha").fill("demo-admin");
    await page.getByRole("button", { name: "Entrar" }).click();
    const codeCell = page.getByText(code!).filter({ visible: true });
    await expect(codeCell).toBeVisible();
    const bookingEntry = codeCell.locator("xpath=ancestor::tr[1] | ancestor::article[1]");
    page.once("dialog", (dialog) => dialog.accept());
    await bookingEntry.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByText(/horário foi liberado/i)).toBeVisible();

    await page.goto("/");
    await page.locator("#booking-date").fill(nextWeekdayDate());
    await page.getByRole("button", { name: "Ver horários disponíveis" }).click();
    await expect(page.getByRole("button", { name: bookedTime?.trim() ?? "14:00" }).first()).toBeVisible();

    if (isMobile) {
      const noHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
      expect(noHorizontalOverflow).toBe(true);
    }
  });
});
