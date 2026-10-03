import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from '@/lib/auth/guards';
import { resolveCapabilities } from "@/backend/ai/roleCapabilities";

/**
 * GET /api/ai/capabilities — role-aware surface for the chat UI: the user's
 * label, whether they can book, their default booking route, starter quick
 * actions and the pages the assistant may open. Lets the UI render role-aware
 * starters without hardcoding any role logic on the client.
 */
export async function GET() {
  if (process.env.NEXT_PUBLIC_AI_FEATURES_ENABLED !== "true") {
    return NextResponse.json({ capabilities: null });
  }

  const { error, user } = await requireAuthenticatedUser();
  if (error) return error;

  const caps = resolveCapabilities(user.roles ?? []);
  return NextResponse.json({
    capabilities: {
      label: caps.label,
      canBook: caps.canBook,
      defaultFormRoute: caps.defaultFormRoute,
      quickActions: caps.quickActions,
      destinations: caps.destinations,
    },
  });
}
