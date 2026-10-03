/** Live data context fetchers (rates, facilities, courses). */

import { createAdminClient } from "@/lib/supabase/server";
import { BuildingPricingService } from "@/backend/admin/building";
import { getCoursesForFacultyBooking } from "@/backend/course";
import type { FacilityRecord, PaidFacilityRateInfo } from "./shared";

// ─── Fetch live rates for paid facilities ─────────────────────────────────────
export interface PaidRatesResult {
  configured: PaidFacilityRateInfo[];
  unconfigured: string[];
}

export async function getPaidFacilityRates(facilities: FacilityRecord[]): Promise<PaidRatesResult> {
  const paid = facilities.filter((f) => f.is_paid_facility);
  if (!paid.length) return { configured: [], unconfigured: [] };

  const results = await Promise.all(
    paid.map(async (f) => {
      try {
        const rates = await BuildingPricingService.getFacilityRatesPublic(f.id);
        if (!rates) return { name: f.name, info: null };
        return {
          name: f.name,
          info: {
            facilityId: f.id,
            facilityName: f.name,
            amRate: rates.amRate ?? 580,
            pmRate: rates.pmRate ?? 780,
            cutoffHour: rates.amCutoffHour ?? 17,
          },
        };
      } catch {
        return { name: f.name, info: null };
      }
    })
  );

  return {
    configured: results.filter((r) => r.info !== null).map((r) => r.info as PaidFacilityRateInfo),
    unconfigured: results.filter((r) => r.info === null).map((r) => r.name),
  };
}

// ─── Fetch real facility + availability data ──────────────────────────────────
export async function getFacilityContext(
  booking_date: string | null,
  start_time: string | null,
  end_time: string | null,
  baseUrl: string
): Promise<{ contextText: string; facilities: FacilityRecord[] }> {
  try {
    let url = `${baseUrl}/api/ai/available-facilities`;
    if (booking_date && start_time && end_time) {
      url += `?date=${booking_date}&start=${start_time}&end=${end_time}`;
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { contextText: "Facility data temporarily unavailable.", facilities: [] };

    const { facilities } = (await res.json()) as { facilities: FacilityRecord[] };
    if (!facilities?.length) return { contextText: "No active facilities found.", facilities: [] };

    const available = facilities.filter((f) => f.is_available);
    const unavailable = facilities.filter((f) => !f.is_available);

    let text = "REAL FACILITY DATA — use ONLY these IDs and names, never invent rooms:\n\n";
    text += "AVAILABLE ROOMS";
    if (booking_date && start_time) text += ` (free on ${booking_date} ${start_time}–${end_time})`;
    text += ":\n";

    if (available.length === 0) {
      text += "  (no rooms available for that time — ask the user to pick a different slot)\n";
    } else {
      available.forEach((f) => {
        const paidTag = f.is_paid_facility ? " [PAID — rental facility, requires payment]" : "";
        const specTag = f.specialized_tag ? ` [SPECIALIZED:${f.specialized_tag}]` : "";
        text += `  - ID: ${f.id} | Name: "${f.name}"${paidTag}${specTag} | Type: ${f.facility_type_name ?? "unknown"} | Capacity: ${f.capacity} | Floor: ${f.floor_name ?? "unknown"}\n`;
      });
    }

    if (unavailable.length > 0) {
      text += "\nUNAVAILABLE ROOMS (already booked — do NOT suggest these):\n";
      unavailable.forEach((f) => {
        text += `  - "${f.name}" — TAKEN\n`;
      });
    }

    return { contextText: text, facilities };
  } catch {
    return { contextText: "Facility data temporarily unavailable.", facilities: [] };
  }
}

// ─── Fetch user's departments / courses ───────────────────────────────────────
export async function getCoursesContext(userId: string | null | undefined): Promise<string> {
  if (!userId) {
    return "COURSE DATA UNAVAILABLE — set booking_department_code, booking_course_code, session_type to null.";
  }
  try {
    const supabase = createAdminClient();
    const result = await getCoursesForFacultyBooking(supabase, userId);
    const depts = result?.departments ?? [];
    const deptsWithCourses = depts.filter(
      (d) => (d.assigned_courses?.length ?? 0) + (d.other_courses?.length ?? 0) > 0
    );
    if (deptsWithCourses.length === 0) {
      return "COURSE DATA UNAVAILABLE — set booking_department_code, booking_course_code, session_type to null.";
    }

    let text = "YOUR DEPARTMENTS / COURSES — use ONLY these EXACT codes (or null). Never invent codes:\n";
    for (const d of deptsWithCourses) {
      text += `  Dept "${d.department_code}" — ${d.department_name}\n`;
      const assigned = d.assigned_courses ?? [];
      const other = d.other_courses ?? [];
      if (assigned.length) {
        text += `    Assigned (prefer these):\n`;
        for (const c of assigned) {
          text += `      - code "${c.course_code}" | "${c.course_name}" | delivery_mode: ${c.delivery_mode}\n`;
        }
      }
      if (other.length) {
        text += `    Other offered:\n`;
        for (const c of other.slice(0, 5)) {
          text += `      - code "${c.course_code}" | "${c.course_name}" | delivery_mode: ${c.delivery_mode}\n`;
        }
        if (other.length > 5) text += `      (…${other.length - 5} more)\n`;
      }
    }
    return text;
  } catch (err) {
    console.error("[chat] getCoursesContext failed:", err);
    return "COURSE DATA UNAVAILABLE — set booking_department_code, booking_course_code, session_type to null.";
  }
}

