import { defineTheme } from '@astryxdesign/core/theme'
import { neutralTheme } from '@astryxdesign/theme-neutral/built'

/** Brand roles remain owned by themes.css; Astryx consumes those same roles. */
export const stowawayTheme = defineTheme({
  name: 'stowaway',
  extends: neutralTheme,
  typography: {
    scale: { base: 16, ratio: 1.2 },
    body: { family: 'Barlow', fallbacks: 'system-ui, sans-serif' },
    heading: { family: 'Barlow', fallbacks: 'system-ui, sans-serif' },
    code: { family: 'Barlow', fallbacks: 'system-ui, sans-serif' },
  },
  tokens: {
    '--color-background-body': 'var(--stowaway-canvas)',
    '--color-background-surface': 'var(--stowaway-surface)',
    '--color-background-card': 'var(--stowaway-surface)',
    '--color-background-muted': 'var(--stowaway-mist)',
    '--color-background-inverted': 'var(--stowaway-ink)',
    '--color-text-primary': 'var(--stowaway-ink)',
    '--color-text-secondary': 'var(--stowaway-muted)',
    '--color-accent': 'var(--stowaway-coral)',
    '--color-on-accent': 'var(--stowaway-on-primary)',
    '--color-text-accent': 'var(--stowaway-ink)',
    '--color-icon-accent': 'var(--stowaway-ink)',
    '--color-border': 'var(--stowaway-border)',
    '--color-border-emphasized': 'var(--stowaway-control-border)',
    '--color-text-error': 'var(--stowaway-danger-ink)',
    '--color-text-warning': 'var(--stowaway-warning-ink)',
    '--color-text-success': 'var(--stowaway-success-ink)',
    '--focus-outline-color': 'var(--stowaway-ink)',
    '--radius-element': 'var(--stowaway-radius-control)',
    '--radius-container': 'var(--stowaway-radius-surface)',
  },
  components: {
    button: {
      base: { minHeight: '44px', height: 'auto', padding: '.625rem 1rem', fontSize: '1rem', fontWeight: '600', lineHeight: '1.4', borderRadius: 'var(--stowaway-radius-control)' },
      'variant:primary': { backgroundColor: 'var(--stowaway-coral)', color: 'var(--stowaway-on-primary)' },
      'variant:secondary': { backgroundColor: 'var(--stowaway-mist)', color: 'var(--stowaway-ink)' },
      'variant:ghost': { backgroundColor: 'transparent', color: 'var(--stowaway-ink)' },
      'variant:destructive': { backgroundColor: 'var(--stowaway-danger-bg)', color: 'var(--stowaway-danger-ink)' },
    },
    card: { base: { display: 'block', padding: '1.25rem', borderRadius: 'var(--stowaway-radius-surface)', backgroundColor: 'var(--stowaway-surface)', color: 'var(--stowaway-ink)' } },
    'text-input': { base: { minHeight: '46px', height: 'auto', fontSize: '1rem', backgroundColor: 'var(--stowaway-surface)', color: 'var(--stowaway-ink)', borderColor: 'var(--stowaway-control-border)' } },
    'segmented-control': { base: { padding: '3px', borderRadius: '12px', backgroundColor: 'var(--stowaway-mist)' } },
    'segmented-control-item': {
      base: { minHeight: '44px', height: 'auto', padding: '.5rem .75rem', fontSize: '1rem', color: 'var(--stowaway-ink)', borderRadius: '9px' },
      selected: { backgroundColor: 'var(--stowaway-ink)', color: 'var(--stowaway-on-action)' },
    },
    dialog: { base: { backgroundColor: 'var(--stowaway-surface)', color: 'var(--stowaway-ink)', borderRadius: '20px' } },
    'collapsible-trigger': { base: { minHeight: '44px', fontSize: '1rem', color: 'var(--stowaway-ink)' } },
  },
})
