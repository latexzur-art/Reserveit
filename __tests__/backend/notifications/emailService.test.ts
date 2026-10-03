import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted ensures these are defined before vi.mock() factory runs
const { mockPost, mockApi } = vi.hoisted(() => {
  const mockPost = vi.fn().mockResolvedValue({})
  const mockApi = vi.fn(() => ({ post: mockPost }))
  return { mockPost, mockApi }
})

vi.mock('@azure/identity', () => ({
  ClientSecretCredential: vi.fn(),
}))

vi.mock(
  '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials',
  () => ({ TokenCredentialAuthenticationProvider: vi.fn() })
)

vi.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    initWithMiddleware: vi.fn(() => ({ api: mockApi })),
  },
}))

// Import AFTER mocks are set up
import { sendEmail } from '@/backend/notifications/emailService'

const TO = 'academichead@reserveitlucena.onmicrosoft.com'
const SENDER = 'noreply@reserveitlucena.onmicrosoft.com'

beforeEach(() => {
  vi.clearAllMocks()
  // Restore env vars that some tests may delete
  process.env.AZURE_CLIENT_SECRET = 'test-client-secret'
  process.env.AZURE_TENANT_ID = 'test-tenant-id'
  process.env.MAIL_SENDER_ADDRESS = SENDER
})

describe('sendEmail', () => {
  it('calls Graph API post with correct single recipient', async () => {
    await sendEmail({ to: TO, subject: 'Test', htmlBody: '<p>body</p>' })

    expect(mockPost).toHaveBeenCalledTimes(1)
    const callArg = mockPost.mock.calls[0][0]
    expect(callArg.message.toRecipients).toEqual([
      { emailAddress: { address: TO } },
    ])
  })

  it('calls Graph API with multiple recipients when to is an array', async () => {
    const recipients = ['user1@example.com', 'user2@example.com']
    await sendEmail({ to: recipients, subject: 'Multi', htmlBody: '<p>body</p>' })

    const callArg = mockPost.mock.calls[0][0]
    expect(callArg.message.toRecipients).toHaveLength(2)
    expect(callArg.message.toRecipients[0].emailAddress.address).toBe('user1@example.com')
    expect(callArg.message.toRecipients[1].emailAddress.address).toBe('user2@example.com')
  })

  it('calls Graph API with correct sender URL', async () => {
    await sendEmail({ to: TO, subject: 'Test', htmlBody: '<p>body</p>' })

    expect(mockApi).toHaveBeenCalledWith(
      expect.stringContaining(SENDER)
    )
  })

  it('preserves subject exactly in the message payload', async () => {
    const subject = '[ReserveIT] Exact Subject Test'
    await sendEmail({ to: TO, subject, htmlBody: '<p>body</p>' })

    const callArg = mockPost.mock.calls[0][0]
    expect(callArg.message.subject).toBe(subject)
  })

  it('sends body as HTML content type', async () => {
    await sendEmail({ to: TO, subject: 'Test', htmlBody: '<p>hello</p>' })

    const callArg = mockPost.mock.calls[0][0]
    expect(callArg.message.body.contentType).toBe('HTML')
    expect(callArg.message.body.content).toBe('<p>hello</p>')
  })

  it('does not save to sent items', async () => {
    await sendEmail({ to: TO, subject: 'Test', htmlBody: '<p>body</p>' })

    const callArg = mockPost.mock.calls[0][0]
    expect(callArg.saveToSentItems).toBe(false)
  })

  it('reports skipped (not success) when AZURE_CLIENT_SECRET is missing', async () => {
    delete process.env.AZURE_CLIENT_SECRET

    const result = await sendEmail({ to: TO, subject: 'Test', htmlBody: '<p>body</p>' })

    expect(result).toEqual({ success: false, skipped: true, error: expect.any(String) })
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('reports skipped when AZURE_TENANT_ID is missing', async () => {
    delete process.env.AZURE_TENANT_ID

    const result = await sendEmail({ to: TO, subject: 'Test', htmlBody: '<p>body</p>' })

    expect(result).toEqual({ success: false, skipped: true, error: expect.any(String) })
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('reports failure (not success) when Graph API returns an error, without throwing', async () => {
    mockPost.mockRejectedValueOnce(new Error('Graph 500'))

    const result = await sendEmail({ to: TO, subject: 'Fail test', htmlBody: '<p>body</p>' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Graph 500')
    }
  })

  it('reports success on a successful send', async () => {
    const result = await sendEmail({ to: TO, subject: 'OK', htmlBody: '<p>body</p>' })
    expect(result).toEqual({ success: true })
  })
})
