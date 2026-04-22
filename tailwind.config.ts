import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0F1B3D',
        orange: {
          DEFAULT: '#F58220',
          dark: '#D66A10',
        },
        ink: {
          900: '#111111',
          700: '#4A4A4A',
          500: '#6B6B6B',
          400: '#9B9B9B',
        },
        border: {
          DEFAULT: '#ECECEC',
          subtle: '#F5F5F5',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          sidebar: '#FAFAF9',
          hover: '#F5F5F5',
        },
        status: {
          abierto: '#2563EB',
          contestado: '#C88A04',
          terminado: '#F58220',
          cerrado: '#15803D',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderWidth: {
        DEFAULT: '0.5px',
      },
      borderRadius: {
        sm: '5px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
      },
    },
  },
  plugins: [],
}

export default config
