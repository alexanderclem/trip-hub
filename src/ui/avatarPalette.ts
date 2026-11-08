/** Calm, brand-friendly hues for travelers who haven't chosen a color. All carry white initials. */
export const AVATAR_DEFAULTS = ['#245b69', '#6b4f8c', '#a4513a', '#3f6f4f', '#8a5d14', '#3d5a99', '#994262'] as const

/** A stable default for one traveler: the same name gets the same color on every phone. */
function defaultFor(seed: string | undefined) {
  if (!seed) return AVATAR_DEFAULTS[0]
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.codePointAt(0)!) >>> 0
  return AVATAR_DEFAULTS[hash % AVATAR_DEFAULTS.length]!
}

/** Keep initials readable even when a traveler chooses a pale avatar color. */
export function avatarPalette(color: string | null, seed?: string) {
  const background = color && /^#[\da-f]{6}$/i.test(color) ? color : defaultFor(seed)
  const rgb = background.slice(1).match(/../g)!.map((part) => {
    const value = parseInt(part, 16) / 255
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
  })
  const luminance = rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722
  return { background, lightText: luminance <= .179 }
}
