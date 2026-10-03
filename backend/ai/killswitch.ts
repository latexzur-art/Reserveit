/**
 * Runtime kill-switch for the AI assistant. Merges the static env kill lists
 * (`AI_KILL_ROLES` / `AI_KILL_ACTIONS`) with runtime Redis flags so an operator
 * can disable a role or a single action INSTANTLY during an incident — no
 * redeploy. Set with e.g. `redis SET ai:kill:roles "it_admin,building_admin"`.
 * The merged result is fed to `applyKillSwitches`. Fails safe: on any Redis
 * error it falls back to the env-only lists.
 *
 * @module backend/ai/killswitch
 */

import { redis } from "@/lib/redis";

export interface KillEnv {
  AI_KILL_ROLES?: string;
  AI_KILL_ACTIONS?: string;
  [k: string]: string | undefined;
}

/** Pure merge of two comma-lists (dedup, drop blanks). */
export function mergeKillEnv(base: KillEnv, runtime: KillEnv): KillEnv {
  const join = (a?: string, b?: string) =>
    [...new Set([...(a ?? "").split(","), ...(b ?? "").split(",")].map((s) => s.trim()).filter(Boolean))].join(",");
  return {
    AI_KILL_ROLES: join(base.AI_KILL_ROLES, runtime.AI_KILL_ROLES),
    AI_KILL_ACTIONS: join(base.AI_KILL_ACTIONS, runtime.AI_KILL_ACTIONS),
  };
}

/** Env kill lists merged with runtime Redis flags (ai:kill:roles / ai:kill:actions). */
export async function getRuntimeKillEnv(base: KillEnv = process.env as KillEnv): Promise<KillEnv> {
  try {
    const [roles, actions] = await Promise.all([
      redis.get<string>("ai:kill:roles"),
      redis.get<string>("ai:kill:actions"),
    ]);
    return mergeKillEnv(
      { AI_KILL_ROLES: base.AI_KILL_ROLES, AI_KILL_ACTIONS: base.AI_KILL_ACTIONS },
      { AI_KILL_ROLES: roles ?? undefined, AI_KILL_ACTIONS: actions ?? undefined }
    );
  } catch {
    return { AI_KILL_ROLES: base.AI_KILL_ROLES, AI_KILL_ACTIONS: base.AI_KILL_ACTIONS };
  }
}
