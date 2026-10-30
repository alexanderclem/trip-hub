import { describe, expect, it, vi } from 'vitest'
import { gmailAccessToken, gmailSend, rawMessage, renderEmail } from './email.ts'

const decode = (raw: string) => Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')

describe('email templates', () => {
  it('tells a traveler what they paid, what is left, and gives both links', () => {
    const m = renderEmail('payment_received', { traveler_name: 'Ola', trip_name: 'Lake week', organizer: 'Ana Trips', amount_minor: 30000, kind: 'deposit',
      paid_minor: 30000, price_minor: 150000, balance_due_date: '2027-02-01', trip_url: 'https://joinstowaway.app/t/x/overview', manage_url: 'https://joinstowaway.app/b/tok' })
    expect(m.fromName).toBe('Stowaway for Ana Trips')
    expect(m.subject).toBe('Lake week: $300.00 received')
    expect(m.text).toContain('Still to pay: $1,200.00, by February 1, 2027.')
    expect(m.text).toContain('https://joinstowaway.app/b/tok')
  })

  it('words reminders by how far off the due date is', () => {
    const base = { traveler_name: 'Ola', trip_name: 'Lake week', organizer: 'Ana Trips', due_minor: 120000, balance_due_date: '2027-02-01', manage_url: 'u' }
    expect(renderEmail('balance_reminder', { ...base, days: 7 }).text).toContain('due in 7 days, on February 1, 2027')
    expect(renderEmail('balance_reminder', { ...base, days: 1 }).text).toContain('due tomorrow')
    expect(renderEmail('balance_reminder', { ...base, days: -3 }).subject).toContain('overdue')
  })

  it('refuses unknown templates', () => {
    expect(() => renderEmail('nope', {})).toThrow(/Unknown/)
  })
})

describe('Gmail', () => {
  it('builds a message whose headers can’t be injected, with UTF-8 subjects', () => {
    const raw = rawMessage({ fromName: 'Stowaway for Ana', fromAddress: 'stowaway@gmail.com', to: 'ola@example.com\r\nBcc: evil@example.com', replyTo: 'ana@example.com', subject: 'Lago Atitlán: $300 received', text: 'Hola' })
    const text = decode(raw)
    expect(text).not.toMatch(/^Bcc:/m)
    expect(text).toContain('Reply-To: ana@example.com')
    expect(text).toMatch(/^Subject: =\?UTF-8\?B\?/m)
    expect(text).toContain(Buffer.from('Hola').toString('base64'))
  })

  it('gets an access token and sends', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => String(url).includes('oauth2')
      ? new Response(JSON.stringify({ access_token: 'ya29' }), { status: 200 })
      : new Response('{}', { status: 200 }))
    const token = await gmailAccessToken({ clientId: 'c', clientSecret: 's', refreshToken: 'r', fetch: fetchMock as unknown as typeof fetch })
    expect(token).toBe('ya29')
    await gmailSend(token, 'raw', fetchMock as unknown as typeof fetch)
    expect(fetchMock.mock.calls[1]![0]).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send')
    const failing = vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }))
    await expect(gmailAccessToken({ clientId: 'c', clientSecret: 's', refreshToken: 'r', fetch: failing as unknown as typeof fetch })).rejects.toThrow(/invalid_grant/)
  })
})
