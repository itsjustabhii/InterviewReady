/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: ['"SF Mono"', '"Fira Code"', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#dde8ff',
          200: '#bad0ff',
          300: '#84abff',
          400: '#477bff',
          500: '#1a52ff',
          600: '#0033f5',
          700: '#0027e0',
          800: '#0024b6',
          900: '#00228f',
          950: '#001266',
        },
        glass: {
          light: 'rgba(255,255,255,0.72)',
          dark:  'rgba(15,15,20,0.72)',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        glass:      '0 8px 32px 0 rgba(31,38,135,0.15)',
        'glass-sm': '0 4px 16px 0 rgba(31,38,135,0.10)',
        card:       '0 2px 24px rgba(0,0,0,0.08)',
        'card-dark':'0 2px 24px rgba(0,0,0,0.45)',
      },
      animation: {
        'fade-in':    'fadeIn 0.5s ease-out',
        'slide-up':   'slideUp 0.6s ease-out',
        'float':      'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(24px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        float:   { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
      },
    },
  },
  plugins: [],
};
