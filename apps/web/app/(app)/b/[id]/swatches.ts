export const SWATCH_COLORS = [
  'slate',
  'amber',
  'green',
  'indigo',
  'rose',
  'violet',
  'sky',
  'teal',
] as const;

export type SwatchColor = (typeof SWATCH_COLORS)[number];

export const SWATCH_BG: Record<SwatchColor, string> = {
  slate: 'bg-slate-500',
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
  indigo: 'bg-accent',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
  sky: 'bg-sky-500',
  teal: 'bg-teal-500',
};

export function swatchClass(color: string | null | undefined, fallback: SwatchColor = 'slate') {
  if (color && (SWATCH_COLORS as readonly string[]).includes(color)) {
    return SWATCH_BG[color as SwatchColor];
  }
  return SWATCH_BG[fallback];
}
