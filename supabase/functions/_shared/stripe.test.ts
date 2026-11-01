import { describe, expect, it, vi } from 'vitest'
import { formEncode, signForTest, StripeError, stripeClient, verifyWebhook } from './stripe.ts'

describe('Stripe requests', () => {
  it('form-encodes nested params the way Stripe expects', () => {
    expect(decodeURIComponent(formEncode({ mode: 'payment', line_items: [{ price_data: { currency: 'usd', unit_amount: 500 }, quantity: 1 }], payment_method_types: ['card', 'us_bank_account'], skip: undefined })))
      .toBe('mode=payment&line_items[0][price_data][currency]=usd&line_items[0][price_data][unit_amount]=500&line_items[0][quantity]=1&payment_method_types[0]=card&payment_method_types[1]=us_bank_account')
  })

  it('sends the connected account and idempotency key, and raises Stripe’s errors', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ id: 'cs_1' }), { status: 200 }))
    const stripe = stripeClient({ secretKey: 'sk_test_x', fetch: fetchMock as unknown as typeof fetch })
    await stripe.post('/v1/checkout/sessions', { mode: 'payment' }, { account: 'acct_1', idempotencyKey: 'booking:1:deposit' })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions')
    expect(init!.headers).toMatchObject({ Authorization: 'Bearer sk_test_x', 'Stripe-Account': 'acct_1', 'Idempotency-Key': 'booking:1:deposit' })
    expect(init!.body).toBe('mode=payment')
    const failing = stripeClient({ secretKey: 'sk', fetch: (async () => new Response(JSON.stringify({ error: { type: 'card_error', message: 'Declined', code: 'card_declined' } }), { status: 402 })) as unknown as typeof fetch })
    await expect(failing.get('/v1/charges/ch_1')).rejects.toBeInstanceOf(StripeError)
  })
})

describe('webhook signatures', () => {
  const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', created: 1, data: { object: { id: 'cs_1' } } })
  const now = 1_800_000_000

  it('accepts a valid signature from either endpoint secret', async () => {
    const header = await signForTest(payload, 'whsec_connect', now)
    expect((await verifyWebhook(payload, header, ['whsec_platform', 'whsec_connect'], now)).id).toBe('evt_1')
  })

  it('refuses a wrong secret, a changed body, an old timestamp or no header', async () => {
    const header = await signForTest(payload, 'whsec_other', now)
    await expect(verifyWebhook(payload, header, ['whsec_platform'], now)).rejects.toThrow(/does not match/)
    const good = await signForTest(payload, 'whsec_platform', now)
    await expect(verifyWebhook(payload.replace('cs_1', 'cs_2'), good, ['whsec_platform'], now)).rejects.toThrow(/does not match/)
    await expect(verifyWebhook(payload, good, ['whsec_platform'], now + 301)).rejects.toThrow(/too old/)
    await expect(verifyWebhook(payload, null, ['whsec_platform'], now)).rejects.toThrow(/Missing/)
  })
})
