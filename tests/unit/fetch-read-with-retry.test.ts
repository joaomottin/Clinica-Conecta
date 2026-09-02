import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchReadWithRetry } from "@/lib/fetch-read-with-retry";

describe("repetição de leituras HTTP", () => {
  afterEach(() => vi.restoreAllMocks());

  it("repete uma falha 503 e devolve a resposta seguinte", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ slots: [{ label: "14:30" }] }), { status: 200 }));

    const response = await fetchReadWithRetry("https://example.test/api/availability", undefined, {
      retryDelayMs: 0,
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("não repete erros de validação", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 400 }));

    const response = await fetchReadWithRetry("https://example.test/api/availability", undefined, {
      retryDelayMs: 0,
    });

    expect(response.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("impede repetição acidental de escrita", async () => {
    await expect(fetchReadWithRetry("https://example.test/api/appointments", { method: "POST" }))
      .rejects.toThrow(/apenas requisições GET ou HEAD/);
  });
});
