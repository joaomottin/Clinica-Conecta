import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { ClinicServiceError, listAdminAppointments } from "@/lib/clinic/service";
import { apiError } from "@/lib/http";

export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      throw new ClinicServiceError("Sessão administrativa necessária.", 401, "ADMIN_AUTH_REQUIRED");
    }
    return NextResponse.json({ appointments: await listAdminAppointments() });
  } catch (error) {
    return apiError(error);
  }
}
