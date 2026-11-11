import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router'
import { Theme } from '@astryxdesign/core/theme'
import { LinkProvider } from '@astryxdesign/core/Link'
import { stowawayTheme } from '@/themes/stowaway/stowaway'
import { useAppearanceMode } from './appearance'

/** Astryx forwards anchor props/ref; Router keeps history, fragments and modifiers. */
function RouterAnchor({ href = '', ...props }: Omit<ComponentProps<typeof Link>, 'to'> & { href?: string }) {
  return <Link {...props} to={href} />
}

export function StowawayTheme({ children }: { children: ReactNode }) {
  const mode = useAppearanceMode()
  return <Theme theme={stowawayTheme} mode={mode}>
    <LinkProvider component={RouterAnchor}>{children}</LinkProvider>
  </Theme>
}
