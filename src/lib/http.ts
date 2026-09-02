import { NextResponse } from "next/server";

import { RepositoryUnavailableError } from "@/lib/clinic/repository";
import { ClinicServiceError } from "@/lib/clinic/service";

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local-development";
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : requestOrigin;

  if (origin !== requestOrigin && origin !== configuredOrigin) {
    throw new ClinicServiceError("Origem da requisição não permitida.", 403, "ORIGIN_NOT_ALLOWED");
  }
}

export function apiError(error: unknown) {
  if (error instanceof ClinicServiceError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  if (error instanceof RepositoryUnavailableError) {
    console.error("[clinic] repository read unavailable", {
      operation: error.operation,
      ...error.diagnostics,
    });

    return NextResponse.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "A agenda está temporariamente indisponível. Tente novamente em instantes.",
        },
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Não foi possível concluir a operação." } },
    { status: 500 },
  );
}
