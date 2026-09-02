import { NextResponse } from "next/server";

import { getClinicRepository } from "@/lib/clinic/repository";
import { apiError } from "@/lib/http";

export async function GET() {
  try {
    const repository = await getClinicRepository();
    const health = await repository.health();
    return NextResponse.json({ ...health, service: "clinica-webmcp" }, { status: health.ok ? 200 : 503 });
  } catch (error) {
    return apiError(error);
  }
}
