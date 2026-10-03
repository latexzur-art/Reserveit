/** Pure helpers: time formatting, field counting, chips, cost estimate, lookup-row utils. */

import type { CollectedFields, ChatMessage, RoomOption, PaidRateInfo } from "./types";
import { PURPOSE_LABELS, ROW_KEYS, TOOL_LABELS } from "./constants";
import { formatEnumLabel } from "@/lib/enum-labels";

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

export function countCollectedFields(f: CollectedFields): number {
  const key5: (keyof CollectedFields)[] = [
    "booking_purpose", "booking_date", "start_time", "expected_attendees", "facility_id",
  ];
  return key5.filter((k) => f[k] !== null && f[k] !== undefined).length;
}

export function nextWeekdays(count: number, includeSunday = false): string[] {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const results: string[] = [];
  const today = new Date();
  const d = new Date(today);
  d.setDate(d.getDate() + 1);
  while (results.length < count) {
    const dow = d.getDay();
    if (includeSunday || dow !== 0) {
      const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
      const label = diff <= 7 ? `this ${days[dow]}` : `next ${days[dow]}`;
      results.push(label);
    }
    d.setDate(d.getDate() + 1);
  }
  return results;
}

export function getContextChips(
  fields: CollectedFields,
  flow: "standard" | "paid",
  phase: "chatting" | "confirming"
): string[] {
  if (phase === "confirming") return [];

  const noPurpose  = !fields.booking_purpose;
  const noDate     = !fields.booking_date;
  const noTime     = !fields.start_time;
  const noCount    = !fields.expected_attendees;
  const noFacility = !fields.facility_id;
  const purpose    = fields.booking_purpose;

  const [d1, d2, d3] = nextWeekdays(3, flow === "paid");

  if (noPurpose && noDate && noTime) {
    if (flow === "paid") {
      return [
        `Book the gymnasium ${d1}`,
        `Personal sports practice ${d2}`,
        `Community event at the gym ${d3}`,
        `Commercial rental at the gymnasium`,
      ];
    }
    return [
      `Book a room for a class`,
      `Reserve for a school event`,
      `Book for a department meeting`,
      `Find an available room ${d1}`,
    ];
  }

  if (!noPurpose && noDate && noTime) {
    if (purpose === "academic") {
      return [
        `Book a lab ${d1} morning`,
        `Reserve a lecture room ${d1} afternoon`,
        `Book for a thesis defense ${d3}`,
      ];
    }
    if (purpose === "school_event") {
      return [
        `Book the AVR ${d1} morning`,
        `Reserve the auditorium ${d3}`,
      ];
    }
    if (purpose === "department_use") {
      return [
        `Book for a meeting ${d1} morning`,
        `Reserve for a faculty meeting ${d2} afternoon`,
      ];
    }
    if (flow === "paid") {
      return [
        `Personal practice ${d1} morning`,
        `Community event ${d2}`,
      ];
    }
    return [`${d1} morning`, `${d2} afternoon`, `${d3} afternoon`];
  }

  if (!noDate && noTime) {
    if (flow === "paid") {
      return ["7am to 9am", "10am to 12pm", "2pm to 4pm", "5pm to 7pm", "7pm to 9pm"];
    }
    return ["7am to 9am", "10am to 12pm", "2pm to 4pm", "3pm to 5pm", "4pm to 6pm"];
  }

  if (!noTime && noCount) {
    if (purpose === "academic")       return ["15 students", "25 students", "30 students", "40 students", "50 students"];
    if (purpose === "department_use") return ["8 people", "10 people", "15 people", "20 people"];
    if (purpose === "school_event")   return ["40 attendees", "60 attendees", "80 attendees", "120 attendees"];
    if (flow === "paid")              return ["6 people", "10 people", "20 people", "50 people", "80 people"];
    return ["10 people", "20 people", "30 people", "50 people", "100 people"];
  }

  if (!noPurpose && !noDate && !noTime && !noCount && !noFacility) {
    return ["Yes, book it", "Looks good, confirm", "That's correct, proceed"];
  }
  if (!noPurpose && !noDate && !noTime && !noCount) {
    return ["any available room", "just book it", "pick the best room for me"];
  }
  return ["just book it", "any available room", "pick the best room for me"];
}

export function estimatePaidCost(
  start: string | null,
  end: string | null,
  rates?: PaidRateInfo | null
): string {
  const amRate = rates?.amRate ?? 580;
  const pmRate = rates?.pmRate ?? 780;
  const pmCutoff = rates?.cutoffHour ?? 17;
  const amStart = 7;

  if (!start || !end) return `₱${amRate}–₱${pmRate}/hr depending on time`;

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startDec = sh + sm / 60;
  let endDec = eh + em / 60;
  if (endDec <= startDec) endDec += 24;

  const amHours = Math.max(0, Math.min(endDec, pmCutoff) - Math.max(startDec, amStart));
  const pmHours = Math.max(0, (endDec - startDec) - amHours);
  const total = Math.round(amHours * amRate + pmHours * pmRate);
  const fmtH = (h: number) => (h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`);

  if (amHours > 0 && pmHours > 0)
    return `₱${total.toLocaleString()} (${fmtH(amHours)} AM + ${fmtH(pmHours)} PM)`;
  if (pmHours > 0)
    return `₱${total.toLocaleString()} (${fmtH(pmHours)} PM rate)`;
  return `₱${total.toLocaleString()} (${fmtH(amHours)} AM rate)`;
}

// ─── Star rating ──────────────────────────────────────────────────────────────

export function extractRows(result: unknown): unknown[] | null {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as unknown[];
    for (const k of ["users", "bookings", "schedules", "data", "facilities", "results", "logs", "reviews"]) {
      if (Array.isArray(obj[k])) return obj[k] as unknown[];
    }
    const firstArray = Object.values(obj).find((v) => Array.isArray(v));
    if (Array.isArray(firstArray)) return firstArray;
  }
  return null;
}

export function summarizeRow(row: unknown): string {
  if (typeof row === "string") return row;
  if (row && typeof row === "object") {
    const obj = row as Record<string, unknown>;
    const parts: string[] = [];
    for (const k of ROW_KEYS) {
      const v = obj[k];
      if ((typeof v === "string" && v.trim()) || typeof v === "number") {
        parts.push(String(v));
        if (parts.length >= 3) break;
      }
    }
    if (parts.length) return parts.join(" · ");
    return JSON.stringify(obj).slice(0, 80);
  }
  return String(row);
}

export function safeJson(v: unknown): string {
  try {
    const s = JSON.stringify(v, null, 2);
    return s.length > 700 ? `${s.slice(0, 700)}…` : s;
  } catch {
    return String(v);
  }
}

// ─── Generic, id-hiding lookup-table rendering ──────────────────────────────────
// Turns arbitrary lookup tool results into human-friendly tables/key-values so
// the chat never dumps raw JSON or internal UUIDs at the user.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/;

/** Keys hidden from all lookup cards regardless of id-heuristics. */
const INTERNAL_KEYS = new Set(['source']);

/** True for internal identifier keys OR denylist keys the user shouldn't see. */
function isHiddenKey(key: string): boolean {
  if (INTERNAL_KEYS.has(key)) return true;
  const k = key.toLowerCase();
  return k === 'id' || k === 'uuid' || k === 'guid' || k.endsWith('_id') || /[a-z]Id$/.test(key);
}

/** "equipmentCode" | "assigned_room" → "Equipment Code" | "Assigned Room". */
export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Strict snake_case enum token → Title Case (e.g. program_head → "Program Head").
 *  Only converts tokens that are all-lowercase with at least one underscore;
 *  everything else (emails, codes like HVAC-001, plain words) passes through. */
export function humanizeEnumValue(v: string): string {
  // Only convert all-lowercase tokens with underscores (e.g. program_head)
  // Pass through: emails, codes, mixed-case, plain words
  if (v.includes('@')) return v;
  if (/[A-Z]/.test(v)) return v;
  if (!v.includes('_')) return v;
  return formatEnumLabel(v);
}

/** Human-friendly cell value: placeholders, Yes/No, short dates, truncation. */
export function formatCell(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    if (ISO_DATE_RE.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
      }
    }
    return v.length > 48 ? `${v.slice(0, 47)}…` : v;
  }
  if (Array.isArray(v)) return v.length ? `${v.length} item${v.length !== 1 ? "s" : ""}` : "—";
  return "—";
}

export interface DisplayTable {
  headers: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  total: number;
}

/** Build displayable columns from an array of row objects, hiding internal ids
 *  and any column whose values are all UUIDs/objects. Returns null when the
 *  rows aren't objects (caller keeps its own list/empty rendering). */
export function toDisplayTable(rawRows: unknown[], maxCols = 5): DisplayTable | null {
  const rows = rawRows.filter(
    (r): r is Record<string, unknown> => !!r && typeof r === "object" && !Array.isArray(r),
  );
  if (rows.length === 0) return null;

  const keys: string[] = [];
  for (const o of rows.slice(0, 12)) {
    for (const k of Object.keys(o)) if (!keys.includes(k)) keys.push(k);
  }

  const displayable = (key: string): boolean => {
    if (isHiddenKey(key)) return false;
    const vals = rows.map((o) => o[key]);
    const anyScalar = vals.some((v) => v !== null && v !== undefined && typeof v !== "object");
    if (!anyScalar) return false;
    const allUuid = vals.every((v) => v == null || (typeof v === "string" && UUID_RE.test(v)));
    return !allUuid;
  };

  const chosen = keys.filter(displayable).slice(0, maxCols);
  if (chosen.length === 0) return null;

  return {
    headers: chosen.map((k) => ({ key: k, label: humanizeKey(k) })),
    rows,
    total: rows.length,
  };
}

/** Displayable [key, value] pairs of a single object result (ids/nested values dropped),
 *  or null when the result isn't a plain object. */
export function toKeyValues(result: unknown): [string, unknown][] | null {
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const out: [string, unknown][] = [];
  for (const [k, v] of Object.entries(result as Record<string, unknown>)) {
    if (isHiddenKey(k)) continue;
    if (v !== null && typeof v === "object") continue;
    if (typeof v === "string" && UUID_RE.test(v)) continue;
    out.push([k, v]);
  }
  return out;
}

// ─── Discriminated lookup view model ──────────────────────────────────────────

export type LookupView =
  | { kind: 'error'; message: string }
  | { kind: 'person'; fields: [string, string][]; sections: { name: string; content: LookupView }[] }
  | { kind: 'table'; table: DisplayTable; label: string }
  | { kind: 'record'; pairs: [string, string][] }
  | { kind: 'empty' };

/** Pure normalizer: takes a tool name + raw result and returns a view model
 *  the component can render without ever inspecting raw shapes. */
export function buildLookupView(tool: string, result: unknown): LookupView {
  // 1. Error
  if (result && typeof result === 'object' && 'error' in (result as Record<string, unknown>)) {
    return { kind: 'error', message: String((result as Record<string, unknown>).error) };
  }

  // 2. Person (view_person returns { person, facets })
  if (
    tool === 'view_person' &&
    result &&
    typeof result === 'object' &&
    'person' in (result as Record<string, unknown>)
  ) {
    const { person, facets } = result as { person: Record<string, unknown>; facets?: Record<string, unknown> };

    // Build labeled fields from the person object, hiding internal keys
    const fields: [string, string][] = [];
    for (const [k, v] of Object.entries(person)) {
      if (isHiddenKey(k)) continue;
      if (v !== null && typeof v === 'object') continue;
      if (typeof v === 'string' && UUID_RE.test(v)) continue;
      const displayVal = typeof v === 'string' ? humanizeEnumValue(formatCell(v)) : formatCell(v);
      if (displayVal === '—') continue;
      fields.push([humanizeKey(k), displayVal]);
    }

    // Build facet sections
    const sections: { name: string; content: LookupView }[] = [];
    if (facets && typeof facets === 'object') {
      for (const [facetName, facetData] of Object.entries(facets)) {
        sections.push({ name: humanizeKey(facetName), content: buildLookupView('_facet', facetData) });
      }
    }

    return { kind: 'person', fields, sections };
  }

  // 3. Table (array of objects)
  const rows = extractRows(result);
  if (rows && rows.length > 0) {
    const table = toDisplayTable(rows);
    if (table) {
      return { kind: 'table', table, label: TOOL_LABELS[tool] ?? 'Results' };
    }
  }

  // 4. Record (single plain object with displayable scalars)
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const kv = toKeyValues(result);
    if (kv && kv.length > 0) {
      const pairs: [string, string][] = kv.map(([k, v]) => [
        humanizeKey(k),
        typeof v === 'string' ? humanizeEnumValue(formatCell(v)) : formatCell(v),
      ]);
      return { kind: 'record', pairs };
    }
  }

  // 5. Empty
  return { kind: 'empty' };
}
