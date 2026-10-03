// OAuth destinations are supplied by Supabase after it validates client registration.
// This consent surface is specifically for ChatGPT, not an arbitrary redirect endpoint.
export function chatgptRedirect(value: string): string {
  const url = new URL(value)
  if (url.origin !== 'https://chatgpt.com' || url.username || url.password
    || !(url.pathname === '/connector_platform_oauth_redirect' || /^\/aip\/[^/]+\/oauth\/callback$/.test(url.pathname))) {
    throw new Error('This connection has an unsupported return address. Start again from ChatGPT.')
  }
  return url.href
}

const RETURN_KEY = 'stowaway-connector-return'
export function rememberConnectorReturn(path: string) {
  if (!/^\/oauth\/consent\?authorization_id=[a-zA-Z0-9_-]+$/.test(path)) throw new Error('Invalid connection request.')
  sessionStorage.setItem(RETURN_KEY, path)
}
export function takeConnectorReturn(): string | null {
  const value = sessionStorage.getItem(RETURN_KEY)
  sessionStorage.removeItem(RETURN_KEY)
  return value && /^\/oauth\/consent\?authorization_id=[a-zA-Z0-9_-]+$/.test(value) ? value : null
}
