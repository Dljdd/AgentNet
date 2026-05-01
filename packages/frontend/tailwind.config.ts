import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { mono: ['JetBrains Mono', 'Fira Code', 'monospace'] },
      colors: {
        bg: { DEFAULT: '#0a0a0a', card: '#111111', hover: '#1a1a1a' },
        border: { DEFAULT: '#222222', accent: '#333333' },
        accent: { green: '#22c55e', yellow: '#eab308', red: '#ef4444', blue: '#3b82f6' },
      },
    },
  },
} satisfies Config
