import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'Instrument Serif', 'Times New Roman', 'serif'],
        sans:    ['var(--font-sans)', 'General Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        /* Bio — primary accent */
        bio: {
          50:  '#E8FBEE',
          100: '#C9F5D5',
          200: '#97EAB1',
          300: '#5BDB87',
          400: '#2DC964',
          500: '#19B254',
          600: '#0E8C42',
          700: '#0A6B33',
        },
        /* Lilac — reputation / reasoning */
        lilac: {
          300: '#9C89E3',
          400: '#8169D8',
          500: '#6B53C9',
          600: '#5640A8',
        },
        /* Amber — payment in flight / warning */
        amber: {
          300: '#FFD37A',
          400: '#F5B041',
          500: '#D9892A',
        },
        /* Coral — failed / slashed / destructive */
        coral: {
          300: '#FFA8A0',
          400: '#F26B61',
          500: '#D94A40',
        },
        /* Ink — neutrals */
        ink: {
          0:    '#FCFCFB',
          50:   '#F6F7F8',
          100:  '#ECEEF1',
          300:  '#A0A7B6',
          500:  '#5A6378',
          700:  '#262C39',
          900:  '#11141B',
          1000: '#07080B',
        },
      },
      borderRadius: {
        'r-xs':   '4px',
        'r-sm':   '6px',
        'r-md':   '10px',
        'r-lg':   '14px',
        'r-xl':   '20px',
        'r-pill': '999px',
      },
      spacing: {
        's-1':  '4px',
        's-2':  '8px',
        's-3':  '12px',
        's-4':  '16px',
        's-5':  '20px',
        's-6':  '24px',
        's-8':  '32px',
        's-10': '40px',
        's-12': '48px',
        's-16': '64px',
        's-20': '80px',
        's-24': '96px',
      },
      transitionTimingFunction: {
        'snap':  'cubic-bezier(0.2, 0.8, 0.2, 1)',
        'glide': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        'snap':  '120ms',
        'glide': '600ms',
      },
    },
  },
} satisfies Config
