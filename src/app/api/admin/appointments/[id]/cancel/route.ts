import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { cancelBooking, ClinicServiceError } from "@/lib/clinic/service";
import { apiError, requireSameOrigin } from "@/lib/http";

export async function POST(request: Request, context: RouteContext<"/api/admin/appointments/[id]/cancel">) {
  try {
    requireSameOrigin(request);
    if (!(await isAdminAuthenticated())) {
      throw new ClinicServiceError("Sessão administrativa necessária.", 401, "ADMIN_AUTH_REQUIRED");
    }
    const { id } = await context.params;
    return NextResponse.json({ appointment: await cancelBooking(id) });
  } catch (error) {
    return apiError(error);
  }
}
