import { NextResponse } from "next/server";

import { findAvailability } from "@/lib/clinic/service";
import { apiError } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const query = Object.fromEntries(new URL(request.url).searchParams.entries());
    return NextResponse.json(await findAvailability(query));
  } catch (error) {
    return apiError(error);
  }
}
