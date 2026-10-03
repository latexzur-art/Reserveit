#!/usr/bin/env node
/**
 * Multi-environment health check. Probes dev + prod across modules using only
 * public endpoints + the public anon keys (no secrets). Read-only — safe to run
 * against production.
 *
 * Usage:  npm run health            (both)
 *         npm run health -- dev     (one)
 *
 * Classifies app API routes: HTTP < 500 = UP (401/403/400 just mean the route is
 * alive and guarded); >= 500 or network error = DOWN.
 *
 * @module scripts/health-check
 */

const ENVS = {
  dev: {
    app: 'https://reserve-it-dev.vercel.app',
    supabaseUrl: 'https://nqoloqrldqgrbeeujkdw.supabase.co',
    anon: 'sb_publishable_frYUEyjNhVlG1LH-nCqKYA_lPQhp60Z',
  },
  prod: {
    app: 'https://reserve-it-six.vercel.app',
    supabaseUrl: 'https://aascxdiyetopvrxifape.supabase.co',
    anon: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhc2N4ZGl5ZXRvcHZyeGlmYXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2ODg3OTksImV4cCI6MjA4NTI2NDc5OX0.BF5U0UGm1D02Hyn03hURhoSgbSUhEfcOMgJ0gKiQzD4',
  },
}

// App routes to probe (representative of each module). Auth-guarded ones return
// 401/403 which still proves the route compiles and runs.
const ROUTES = [
  ['Homepage', '/'],
  ['Login page', '/login'],
  ['Active academic term', '/api/academic-terms/active'],
  ['Facilities', '/api/facilities'],
  ['Bookings (guarded)', '/api/bookings'],
  ['Admin user stats (guarded)', '/api/admin/users/stats'],
  ['Cron endpoint (guarded)', '/api/cron/booking-reminders'],
]

const ICON = { PASS: '✅', WARN: '⚠️ ', FAIL: '❌' }

async function fetchStatus(url, opts = {}, timeoutMs = 12000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal, redirect: 'manual' })
    return { status: res.status, res }
  } catch (e) {
    return { status: 0, error: e.message }
  } finally {
    clearTimeout(t)
  }
}

async function checkEnv(name, cfg) {
  console.log(`\n${'='.repeat(54)}\n  ${name.toUpperCase()}  →  ${cfg.app}\n${'='.repeat(54)}`)
  let fails = 0

  // 1. Supabase auth provider config
  const settings = await fetchStatus(`${cfg.supabaseUrl}/auth/v1/settings`, { headers: { apikey: cfg.anon } })
  if (settings.status === 200) {
    const j = await settings.res.json()
    const ext = j.external || {}
    for (const p of ['azure', 'google', 'email']) {
      const ok = !!ext[p]
      if (!ok) fails++
      console.log(`${ok ? ICON.PASS : ICON.WARN} auth provider: ${p} = ${ok}`)
    }
  } else {
    fails++
    console.log(`${ICON.FAIL} auth settings unreachable (HTTP ${settings.status}${settings.error ? ' ' + settings.error : ''})`)
  }

  // 2. PostgREST / DB — query a table anon can read (facilities has a public SELECT policy)
  const rest = await fetchStatus(`${cfg.supabaseUrl}/rest/v1/facilities?select=id&limit=1`, { headers: { apikey: cfg.anon, Authorization: `Bearer ${cfg.anon}` } })
  const restOk = rest.status >= 200 && rest.status < 400
  if (!restOk) fails++
  console.log(`${restOk ? ICON.PASS : ICON.FAIL} database (PostgREST) → HTTP ${rest.status}`)

  // 3. Detect Vercel Deployment Protection (preview deployments gate all paths behind Vercel SSO)
  const home = await fetchStatus(cfg.app + '/')
  const isProtected = home.status === 401
  if (isProtected) {
    console.log(`${ICON.WARN} behind Vercel Deployment Protection — anonymous requests get 401; you reach it via your Vercel session. App-route probing below is inconclusive.`)
  }

  // 4. App routes
  for (const [label, path] of ROUTES) {
    const { status, error } = await fetchStatus(cfg.app + path)
    // When protected, every path returns Vercel's 401 wall — that's expected, not an app failure.
    const up = isProtected ? true : status > 0 && status < 500
    if (!up) fails++
    const note = isProtected && status === 401 ? ' 🔒wall' : ''
    const tag = up ? ICON.PASS : ICON.FAIL
    console.log(`${tag} ${label.padEnd(30)} → ${status || 'ERR'}${note}${error ? ' ' + error : ''}`)
  }

  console.log(`\n  ${fails === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${fails} check(s) need attention`}`)
  return fails
}

const arg = process.argv[2]
const targets = arg && ENVS[arg] ? [arg] : Object.keys(ENVS)
let total = 0
for (const t of targets) total += await checkEnv(t, ENVS[t])
console.log(`\n${'─'.repeat(54)}`)
console.log(total === 0 ? '🎉 All environments healthy.' : `Done — ${total} issue(s) across ${targets.length} env(s).`)
process.exit(total === 0 ? 0 : 1)
