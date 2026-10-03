import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from '@/lib/auth/guards';
import { resolveCapabilities, applyKillSwitches, isActorBlocked } from "@/backend/ai/roleCapabilities";
import { executeAction } from "@/backend/ai/actions";
import { checkRateLimitAsync, RATE_LIMITS } from "@/lib/rate-limit";
import { getRuntimeKillEnv } from "@/backend/ai/killswitch";
import { actionNonceKey, claimActionOnce } from "@/backend/ai/idempotency";
import { logAiEvent } from "@/backend/ai/observability";
import { redis } from "@/lib/redis";

/**
 * POST /api/ai/action — the ONLY path that runs a guarded write-action.
 *
 * Called by the chat UI when the user clicks **Confirm** on a proposed action.
 * Triple gate: (1) the capability filter here, (2) the action registry's
 * allowedRoles check inside executeAction, (3) the underlying endpoint's own
 * authorization (executeAction proxies to it with the user's cookie).
 */
export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_AI_FEATURES_ENABLED !== "true") {
    return NextResponse.json({ error: "AI features disabled" }, { status: 403 });
  }

  const { error, user } = await requireAuthenticatedUser();
  if (error) return error;

  // Per-user rate limit on confirmed writes (LLM10).
  const limited = await checkRateLimitAsync(`ai-action:${user.id}`, RATE_LIMITS.AI_ACTION);
  if (limited) return limited;

  let body: { action_type?: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const actionType = typeof body.action_type === "string" ? body.action_type : "";
  const params = body.params && typeof body.params === "object" ? body.params : {};
  if (!actionType) {
    return NextResponse.json({ error: "Missing action_type" }, { status: 400 });
  }

  const roles = (user.roles ?? []).map((r: { name: string }) => r.name);
  const caps = applyKillSwitches(resolveCapabilities(user.roles ?? []), await getRuntimeKillEnv());

  // Actor-status gate — a restricted/suspended/inactive account cannot run writes.
  if (isActorBlocked(user.account_status)) {
    return NextResponse.json(
      { ok: false, message: "Your account is restricted — resolve the restriction (e.g. submit an appeal) before performing this action." },
      { status: 403 }
    );
  }

  // Capability gate — the action registry + the proxied endpoint re-check too.
  if (!(caps.actions as string[]).includes(actionType)) {
    return NextResponse.json(
      { ok: false, message: "This action is not permitted for your role." },
      { status: 403 }
    );
  }

  // Idempotency: a double-click / retry must not execute the same write twice
  // (LLM06 damage limitation). Claim the action; release on failure so a genuine
  // retry after an error is still allowed.
  const nonceKey = actionNonceKey(user.id, actionType, params);
  const claimed = await claimActionOnce(nonceKey, 120);
  if (!claimed) {
    logAiEvent("action_duplicate", { userId: user.id, actionType });
    return NextResponse.json(
      { ok: false, message: "That action was just submitted — I didn't run it again." },
      { status: 409 }
    );
  }

  const result = await executeAction(actionType, params, {
    cookie: req.headers.get("cookie"),
    origin: req.nextUrl.origin,
    userId: user.id,
    roles,
  });

  if (!result.ok) {
    try { await redis.del(nonceKey); } catch { /* fail-open: allow retry */ }
  }
  logAiEvent("action_execute", { userId: user.id, actionType, ok: result.ok, status: result.status });

  return NextResponse.json(result, { status: result.ok ? 200 : result.status ?? 400 });
}
