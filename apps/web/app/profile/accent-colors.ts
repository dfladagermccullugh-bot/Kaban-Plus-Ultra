/**
 * The 8 accent color presets. Names mirror the design-token vocabulary.
 * Each maps to a Tailwind `bg-*` class only used here in the picker preview;
 * the canonical accent in the rest of the app comes from the user's profile
 * value and is applied via CSS variables.
 */
export const ACCENT_COLORS = [
  { name: 'indigo', swatch: 'bg-[oklch(60%_0.18_264)]' },
  { name: 'blue', swatch: 'bg-[oklch(62%_0.17_240)]' },
  { name: 'teal', swatch: 'bg-[oklch(66%_0.14_190)]' },
  { name: 'green', swatch: 'bg-[oklch(65%_0.16_145)]' },
  { name: 'lime', swatch: 'bg-[oklch(76%_0.18_125)]' },
  { name: 'amber', swatch: 'bg-[oklch(75%_0.15_75)]' },
  { name: 'rose', swatch: 'bg-[oklch(64%_0.22_15)]' },
  { name: 'violet', swatch: 'bg-[oklch(60%_0.22_300)]' },
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number]['name'];

export function isAccentColor(value: string): value is AccentColor {
  return ACCENT_COLORS.some((c) => c.name === value);
}
