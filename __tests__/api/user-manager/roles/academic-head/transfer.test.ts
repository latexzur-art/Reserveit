import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const mockRequireUserManager = vi.hoisted(() => vi.fn())
const mockRpc = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/guards', () => ({
  requireUserManager: mockRequireUserManager,
}))

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}))

import { POST } from "@/app/api/user-manager/roles/academic-head/transfer/route"

const CALLER_ID = "caller-uuid-0001"
const FROM_USER = "from-user-uuid-0002"
const TO_USER   = "to-user-uuid-0003"

const mockUserManager = {
  id: CALLER_ID,
  email: "usermanager@test.com",
  full_name: "Test User Manager",
  roles: [{ name: "it_admin" }],
}

function makeRequest(body: object) {
  return new NextRequest(
    "http://localhost:3000/api/user-manager/roles/academic-head/transfer",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  )
}

function setupSuccessfulTransfer() {
  mockRpc.mockResolvedValue({ error: null })
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id: TO_USER, full_name: "New Academic Head", email: "newhead@test.com" },
      error: null,
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireUserManager.mockResolvedValue({ error: null, user: mockUserManager })
  setupSuccessfulTransfer()
})

describe("POST /api/user-manager/roles/academic-head/transfer", () => {

  describe("Authorization", () => {
    it("returns 401 when requireUserManager reports unauthenticated", async () => {
      const errorResponse = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
      mockRequireUserManager.mockResolvedValue({ error: errorResponse as any, user: null })
      const res = await POST(makeRequest({ from_user_id: FROM_USER, to_user_id: TO_USER }))
      expect(res.status).toBe(401)
    })

    it("returns 403 when requireUserManager reports forbidden", async () => {
      const errorResponse = new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
      mockRequireUserManager.mockResolvedValue({ error: errorResponse as any, user: null })
      const res = await POST(makeRequest({ from_user_id: FROM_USER, to_user_id: TO_USER }))
      expect(res.status).toBe(403)
    })
  })

  describe("Input validation", () => {
    it("returns 400 when from_user_id is missing", async () => {
      const res = await POST(makeRequest({ to_user_id: TO_USER }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain("from_user_id")
    })

    it("returns 400 when to_user_id is missing", async () => {
      const res = await POST(makeRequest({ from_user_id: FROM_USER }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain("to_user_id")
    })

    it("returns 400 when from and to are the same user", async () => {
      const res = await POST(makeRequest({ from_user_id: FROM_USER, to_user_id: FROM_USER }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain("different")
    })

    it("returns 400 when body is invalid JSON", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/user-manager/roles/academic-head/transfer",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "not json" }
      )
      const res = await POST(req)
      expect(res.status).toBe(400)
    })
  })

  describe("Successful transfer", () => {
    it("returns 200 with success:true", async () => {
      const res = await POST(makeRequest({ from_user_id: FROM_USER, to_user_id: TO_USER }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it("response message mentions transfer", async () => {
      const res = await POST(makeRequest({ from_user_id: FROM_USER, to_user_id: TO_USER }))
      const body = await res.json()
      expect(body.message).toContain("transferred")
    })

    it("calls transfer_academic_head RPC with correct params", async () => {
      await POST(makeRequest({ from_user_id: FROM_USER, to_user_id: TO_USER }))
      expect(mockRpc).toHaveBeenCalledWith(
        "transfer_academic_head",
        expect.objectContaining({ from_user_id: FROM_USER, to_user_id: TO_USER, assigned_by_id: CALLER_ID })
      )
    })

    it("includes new academic head details in response", async () => {
      const res = await POST(makeRequest({ from_user_id: FROM_USER, to_user_id: TO_USER }))
      const body = await res.json()
      expect(body.new_academic_head).toBeDefined()
      expect(body.new_academic_head.id).toBe(TO_USER)
      expect(body.new_academic_head.full_name).toBe("New Academic Head")
    })

    it("uses caller user.id from requireUserManager as assigned_by_id", async () => {
      await POST(makeRequest({ from_user_id: FROM_USER, to_user_id: TO_USER }))
      const rpcCall = mockRpc.mock.calls.find((c: any[]) => c[0] === "transfer_academic_head")
      expect(rpcCall).toBeDefined()
      expect(rpcCall![1].assigned_by_id).toBe(CALLER_ID)
    })
  })

  describe("DB error handling", () => {
    it("returns 409 when DB trigger rejects duplicate active head", async () => {
      mockRpc.mockResolvedValue({ error: { message: "Only one active Academic Head is allowed at a time. Deactivate the current holder before assigning a new one." } })
      const res = await POST(makeRequest({ from_user_id: FROM_USER, to_user_id: TO_USER }))
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toContain("Only one active Academic Head")
    })

    it("returns 500 on unexpected DB error", async () => {
      mockRpc.mockResolvedValue({ error: { message: "unexpected DB error" } })
      const res = await POST(makeRequest({ from_user_id: FROM_USER, to_user_id: TO_USER }))
      expect(res.status).toBe(500)
    })

    it("returns fallback new_academic_head with just id when user lookup fails", async () => {
      mockRpc.mockResolvedValue({ error: null })
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
      })
      const res = await POST(makeRequest({ from_user_id: FROM_USER, to_user_id: TO_USER }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.new_academic_head).toEqual({ id: TO_USER })
    })
  })
})
