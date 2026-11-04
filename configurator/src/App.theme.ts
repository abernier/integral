// The docs site's Material 3 theme, as the reader set it there: the configurator is served on the docs' origin and
// embedded in their pages, so it reads the same localStorage and follows its changes live. It has no toggle of its own.
import { type ComponentProps, useSyncExternalStore } from 'react'
import type { Leva } from 'leva'
import type { MtbConfig } from 'material-theme-builder'
import type { useMtb } from 'material-theme-builder/react'

/** The `theme` prop of `<Leva>`: leva does not export its type. */
type LevaTheme = NonNullable<ComponentProps<typeof Leva>['theme']>

/** A Material 3 color role, as `useMtb().getMtbColor` takes it. */
export type Role = Parameters<ReturnType<typeof useMtb>['getMtbColor']>[0]

/**
 * The pmndrs seed, the docs' defaults: `pmndrsMtb` in `@pmndrs/docs/src/lib/md3.ts`, and the default scheme of
 * `src/components/PrimaryColorMtb.tsx`. The package exports neither (md3.ts also reads `process.env`): keep these
 * values in step with that file. Its custom colors are left out, the configurator draws none.
 */
export const SEED = {
  source: '#CAF543',
  colorMatch: true,
  contrast: 0,
  scheme: 'tonalSpot',
  neutral: '#c1b793',
  neutralVariant: '#495720',
  error: '#FF4980',
} as const satisfies MtbConfig

/**
 * Where the docs store the reader's picks: next-themes' default `storageKey`, then the keys of
 * `@pmndrs/docs/src/hooks/usePrimaryColor.ts`, `useContrastLevel.ts`, `useScheme.ts` and `useColorMatch.ts`.
 */
export const KEYS = {
  theme: 'theme',
  primaryColor: 'pmndrs-docs:primary-color',
  contrast: 'pmndrs-docs:contrast-level',
  scheme: 'pmndrs-docs:scheme',
  colorMatch: 'pmndrs-docs:color-match',
} as const

// The values the docs accept for each pick: anything else is the default, as the docs treat it.
const HEX_COLOR = /^#[0-9a-f]{6}$/i
const CONTRASTS = ['0', '0.5', '1']
const SCHEMES = ['tonalSpot', 'vibrant', 'expressive', 'fidelity', 'content', 'monochrome', 'neutral'] as const

type Scheme = (typeof SCHEMES)[number]

/** What the theme depends on: the stored picks, `null` when nothing is stored, and the system's color scheme. */
export type Picks = Record<keyof typeof KEYS, string | null> & { prefersDark: boolean }

/**
 * Whether the page is dark: next-themes' stored `light` or `dark`, the system's otherwise (`system`, nothing
 * stored, or a value next-themes does not know).
 */
export function isDark({ theme, prefersDark }: Pick<Picks, 'theme' | 'prefersDark'>) {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return prefersDark
}

/** The `<Mtb>` config of the picks: the seed, reseeded by each pick the docs would accept. */
export function mtbConfig(picks: Picks): MtbConfig {
  const scheme = SCHEMES.find((value) => value === picks.scheme)
  return {
    ...SEED,
    source: picks.primaryColor !== null && HEX_COLOR.test(picks.primaryColor) ? picks.primaryColor : SEED.source,
    contrast: picks.contrast !== null && CONTRASTS.includes(picks.contrast) ? Number(picks.contrast) : SEED.contrast,
    scheme: scheme ?? (SEED.scheme as Scheme),
    colorMatch: picks.colorMatch === 'true' ? true : picks.colorMatch === 'false' ? false : SEED.colorMatch,
  }
}

/** leva's color tokens (see its `getDefaultTheme`) as Material 3 roles, `color` giving a role's hex in the current mode. */
export function levaTheme(color: (role: Role) => string): LevaTheme {
  return {
    colors: {
      // The title bar, the panel, the inputs.
      elevation1: color('surfaceContainerHigh'),
      elevation2: color('surfaceContainer'),
      elevation3: color('surfaceContainerHighest'),
      // Pressed, at rest (buttons, slider fills, focus rings), hovered. The seed sits in the container role.
      accent1: color('primary'),
      accent2: color('primaryContainer'),
      accent3: color('primaryFixedDim'),
      // Input borders, labels, values.
      highlight1: color('outline'),
      highlight2: color('onSurfaceVariant'),
      highlight3: color('onSurface'),
      vivid1: color('error'),
      toolTipBackground: color('inverseSurface'),
      toolTipText: color('inverseOnSurface'),
    },
  }
}

// One snapshot string for every key and the media query: `useSyncExternalStore` compares snapshots by value.
const DARK_QUERY = '(prefers-color-scheme: dark)'

function readPicks(): string {
  const picks: Partial<Picks> = { prefersDark: matchMedia(DARK_QUERY).matches }
  for (const [name, key] of Object.entries(KEYS)) {
    try {
      picks[name as keyof typeof KEYS] = localStorage.getItem(key)
    } catch {
      // localStorage unavailable (blocked, sandboxed iframe): the defaults.
      picks[name as keyof typeof KEYS] = null
    }
  }
  return JSON.stringify(picks)
}

// The `storage` event fires here when another document of the origin (the docs page around the iframe) changes a key.
function subscribe(onChange: () => void) {
  const media = matchMedia(DARK_QUERY)
  window.addEventListener('storage', onChange)
  media.addEventListener('change', onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    media.removeEventListener('change', onChange)
  }
}

/** The docs' theme, live: whether the page is dark, and the `<Mtb>` config of the reader's picks. */
export function useDocsTheme() {
  const picks: Picks = JSON.parse(useSyncExternalStore(subscribe, readPicks))
  return { dark: isDark(picks), mtb: mtbConfig(picks) }
}
