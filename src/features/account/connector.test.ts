import { afterEach, describe, expect, it, vi } from 'vitest'
import { chatgptRedirect, rememberConnectorReturn, takeConnectorReturn } from './connector'

afterEach(() => vi.unstubAllGlobals())
describe('connector redirects', () => {
  it('accepts only official ChatGPT OAuth callbacks', () => {
    expect(chatgptRedirect('https://chatgpt.com/connector_platform_oauth_redirect?code=123&state=abc')).toContain('state=abc')
    expect(chatgptRedirect('https://chatgpt.com/aip/test/oauth/callback?error=access_denied')).toContain('access_denied')
    for (const url of ['https://evil.example/callback', 'javascript:alert(1)', 'https://chatgpt.com.evil.example/aip/test/oauth/callback', 'https://chatgpt.com/other', 'https://user:pass@chatgpt.com/connector_platform_oauth_redirect']) {
      expect(() => chatgptRedirect(url)).toThrow()
    }
  })
  it('preserves one consent return through sign-in, rejecting arbitrary destinations', () => {
    const data = new Map<string, string>()
    vi.stubGlobal('sessionStorage', { setItem: (k: string, v: string) => data.set(k, v), getItem: (k: string) => data.get(k), removeItem: (k: string) => data.delete(k) })
    rememberConnectorReturn('/oauth/consent?authorization_id=abc-123')
    expect(takeConnectorReturn()).toBe('/oauth/consent?authorization_id=abc-123')
    expect(takeConnectorReturn()).toBeNull()
    expect(() => rememberConnectorReturn('//evil.example')).toThrow()
    expect(() => rememberConnectorReturn('/oauth/consent?authorization_id=123&redirect=evil')).toThrow()
  })
})
