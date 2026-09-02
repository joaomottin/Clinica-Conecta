import { NextResponse } from "next/server";

import { getClinicInfo } from "@/lib/clinic/service";
import { apiError } from "@/lib/http";

export async function GET() {
  try {
    return NextResponse.json(await getClinicInfo());
  } catch (error) {
    return apiError(error);
  }
}
