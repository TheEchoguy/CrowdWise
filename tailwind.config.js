/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070A14',
          900: '#0B1020',
          850: '#0E1528',
          800: '#121A2B',
          750: '#152033',
          700: '#192438',
          600: '#23324D',
          500: '#344768',
          400: '#52698D',
          300: '#7E95BA',
        },
        accent: {
          cyan: '#06B6D4',
          'cyan-bright': '#22D3EE',
          violet: '#8B5CF6',
          'violet-bright': '#A78BFA',
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#EF4444',
          blue: '#3B82F6',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      }
    },
  },
  plugins: [],
}

