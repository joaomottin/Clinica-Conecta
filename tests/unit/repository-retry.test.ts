import { describe, expect, it, vi } from "vitest";

import {
  RepositoryUnavailableError,
  withRepositoryReadRetry,
} from "@/lib/clinic/repository";

describe("resiliência das leituras do repositório", () => {
  it("repete uma falha transitória", async () => {
    const read = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("falha transitória"), { code: "PGRST000" }))
      .mockResolvedValueOnce(["horário"]);

    await expect(withRepositoryReadRetry("listAppointments", read, [0]))
      .resolves.toEqual(["horário"]);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("expõe somente diagnósticos técnicos após esgotar as tentativas", async () => {
    const read = vi.fn().mockRejectedValue(
      Object.assign(new Error("detalhe interno que não deve ir para o cliente"), { code: "PGRST002" }),
    );

    const result = withRepositoryReadRetry("getCatalog", read, [0]);

    await expect(result).rejects.toEqual(expect.objectContaining<Partial<RepositoryUnavailableError>>({
      operation: "getCatalog",
      diagnostics: { name: "Error", code: "PGRST002", causeCode: undefined },
    }));
    expect(read).toHaveBeenCalledTimes(2);
  });
});
