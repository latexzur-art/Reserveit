import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { listFacilitiesWithAvailability } from "@/backend/booking/availabilityQuery";

export async function GET(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_AI_FEATURES_ENABLED !== "true") {
    return NextResponse.json({ error: "AI features disabled" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");       // YYYY-MM-DD
  const startTime = searchParams.get("start"); // HH:MM
  const endTime = searchParams.get("end");     // HH:MM

  const supabase = createAdminClient();

  try {
    const facilities = await listFacilitiesWithAvailability(supabase, {
      date,
      start: startTime,
      end: endTime,
    });
    return NextResponse.json({ facilities });
  } catch (err) {
    console.error("[available-facilities] query failed:", err);
    return NextResponse.json({ error: "Failed to fetch facilities" }, { status: 500 });
  }
}
