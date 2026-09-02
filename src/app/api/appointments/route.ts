import { NextResponse } from "next/server";

import { createBooking } from "@/lib/clinic/service";
import { apiError, getClientIp, requireSameOrigin } from "@/lib/http";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    const result = await createBooking(body, { clientIp: getClientIp(request) });
    return NextResponse.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    return apiError(error);
  }
}
