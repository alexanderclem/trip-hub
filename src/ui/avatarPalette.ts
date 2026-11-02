/** Keep initials readable even when a traveler chooses a pale avatar color. */
export function avatarPalette(color: string | null) {
  const background = color && /^#[\da-f]{6}$/i.test(color) ? color : '#245b69'
  const rgb = background.slice(1).match(/../g)!.map((part) => {
    const value = parseInt(part, 16) / 255
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
  })
  const luminance = rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722
  return { background, lightText: luminance <= .179 }
}
