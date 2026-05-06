import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        retro: {
          bg: '#C5C6A8',        // sage/olive background
          surface: '#F0F0E8',   // warm cream cards
          'surface-alt': '#E8E6D8', // slightly darker cream
          accent: '#D4654A',    // coral accent
          'accent-hover': '#C0553C',
          blue: '#4A6FA5',      // retro window blue
          'blue-dark': '#3A5A8A',
          gold: '#C4A55A',      // button border gold
          'btn': '#F5E6B8',     // warm cream button
          'btn-hover': '#EDD99E',
          text: '#2A2A28',      // near-black text
          muted: '#7A7A6E',     // olive gray muted
          border: '#B0B09A',    // sage border
          'border-dark': '#8A8A76',
        },
        dark: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712',
        },
      },
    },
  },
  darkMode: 'class',
  plugins: [],
} satisfies Config
