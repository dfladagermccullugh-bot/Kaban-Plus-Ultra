/**
 * Shared Tailwind v4 preset for Kaban Plus Ultra.
 * Tokens are defined in CSS via @theme in each app's globals.css.
 * This preset only exposes content paths and plugin defaults.
 */
/** @type {import('tailwindcss').Config} */
const preset = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [],
  theme: {
    extend: {
      borderRadius: {
        sm: '12px',
        md: '16px',
        lg: '20px',
      },
      boxShadow: {
        sm: '0 1px 2px oklch(0% 0 0 / 0.06)',
        md: '0 8px 24px oklch(0% 0 0 / 0.12)',
      },
      fontFamily: {
        sans: [
          'Inter Variable',
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        mono: ['JetBrains Mono Variable', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
};

export default preset;
