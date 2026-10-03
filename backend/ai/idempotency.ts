/**
 * Idempotency for confirmed write-actions — prevents a double-click / retry from
 * executing the same mutation twice (OWASP LLM06 damage limitation). Backed by
 * Upstash Redis SET NX; fails OPEN (allows the action) when Redis is absent or
 * errors, since this is a duplicate guard, not an authorization control.
 *
 * @module backend/ai/idempotency
 */

import { createHash } from "node:crypto";
import { getRedisClient } from "@/lib/redis";

/** Stable key from the acting user + action type + params (sorted). */
export function actionNonceKey(
  userId: string,
  actionType: string,
  params: Record<string, unknown>
): string {
  const stable = JSON.stringify(params ?? {}, Object.keys(params ?? {}).sort());
  const digest = createHash("sha1").update(`${userId}|${actionType}|${stable}`).digest("hex");
  return `ai:action:once:${digest}`;
}

/** Set-if-absent primitive; returns true when THIS call created the key. */
export type SetNx = (key: string, ttlSec: number) => Promise<boolean>;

const redisSetNx: SetNx = async (key, ttlSec) => {
  const client = getRedisClient();
  if (!client) return true; // fail-open: no store → don't block
  const res = await client.set(key, "1", { nx: true, ex: ttlSec });
  return res === "OK";
};

/**
 * Claim an action exactly once within `ttlSec`. Returns true on the first claim,
 * false for a duplicate. `setNx` is injectable for tests; null → fail-open.
 */
export async function claimActionOnce(
  key: string,
  ttlSec: number,
  setNx: SetNx | null = redisSetNx
): Promise<boolean> {
  if (!setNx) return true;
  try {
    return await setNx(key, ttlSec);
  } catch {
    return true; // fail-open on store error
  }
}
