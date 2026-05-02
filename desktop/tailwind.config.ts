import type { Config } from 'tailwindcss'

export default {
  darkMode: ["class"],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    // Slot-based colors (defined in shared/utils/slot-colors.ts)
    // Text colors - 400 level (primary)
    'text-red-400',      // weapon
    'text-amber-400',    // shield
    'text-purple-400',   // helmet
    'text-blue-400',     // body-armour
    'text-teal-400',     // gloves
    'text-yellow-400',   // boots
    'text-orange-400',   // belt
    'text-pink-400',     // amulet
    'text-cyan-400',     // ring
    'text-emerald-400',  // flask
    'text-violet-400',   // tincture
    'text-indigo-400',   // jewel
    'text-slate-400',    // fallback
    'text-green-400',    // stat (semantic highlighting)
    // Text colors - 300 level (softer, for semantic highlighting tier 2)
    'text-blue-300',     // skill
    'text-purple-300',   // notable
    'text-amber-300',    // slot
    // Background colors
    'bg-red-500/20',     // weapon
    'bg-amber-500/20',   // shield
    'bg-purple-500/20',  // helmet
    'bg-blue-500/20',    // body-armour
    'bg-teal-500/20',    // gloves
    'bg-yellow-500/20',  // boots
    'bg-orange-500/20',  // belt
    'bg-pink-500/20',    // amulet
    'bg-cyan-500/20',    // ring
    'bg-emerald-500/20', // flask
    'bg-violet-500/20',  // tincture
    'bg-indigo-500/20',  // jewel
    'bg-slate-500/20',   // fallback
    // Border colors
    'border-red-500/50',     // weapon
    'border-amber-500/50',   // shield
    'border-purple-500/50',  // helmet
    'border-blue-500/50',    // body-armour
    'border-teal-500/50',    // gloves
    'border-yellow-500/50',  // boots
    'border-orange-500/50',  // belt
    'border-pink-500/50',    // amulet
    'border-cyan-500/50',    // ring
    'border-emerald-500/50', // flask
    'border-violet-500/50',  // tincture
    'border-indigo-500/50',  // jewel
    'border-slate-500',      // fallback
    // Glow classes
    'shadow-red-500/20',     // weapon
    'shadow-amber-500/20',   // shield
    'shadow-purple-500/20',  // helmet
    'shadow-blue-500/20',    // body-armour
    'shadow-teal-500/20',    // gloves
    'shadow-yellow-500/20',  // boots
    'shadow-orange-500/20',  // belt
    'shadow-pink-500/20',    // amulet
    'shadow-cyan-500/20',    // ring
    'shadow-emerald-500/20', // flask
    'shadow-violet-500/20',  // tincture
    'shadow-indigo-500/20',  // jewel
    'shadow-slate-500/20',   // fallback

    // Rating glow classes for EquipmentGrid
    'shadow-[0_0_12px_rgba(16,185,129,0.4)]',   // green/GOOD
    'shadow-[0_0_10px_rgba(234,179,8,0.3)]',    // yellow/AVERAGE
    'shadow-[0_0_12px_rgba(249,115,22,0.4)]',   // orange/POOR
    'shadow-[0_0_16px_rgba(239,68,68,0.5)]',    // red/CRITICAL

    // Pathway glow classes for improvement cards
    'shadow-[0_0_15px_rgba(6,182,212,0.15)]',   // cyan (skills)
    'shadow-[0_0_15px_rgba(168,85,247,0.15)]',  // magenta (tree)
    'shadow-[0_0_15px_rgba(251,191,36,0.15)]',  // amber (gear)

    // Score gauge glows
    'shadow-[0_0_20px_rgba(239,68,68,0.4)]',    // red score glow
    'shadow-[0_0_20px_rgba(234,179,8,0.4)]',    // yellow score glow
    'shadow-[0_0_20px_rgba(34,197,94,0.4)]',    // green score glow
    'shadow-[0_0_20px_rgba(251,191,36,0.5)]',   // gold score glow
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Cinzel', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-subtle': 'pulse-subtle 3s ease-in-out infinite',
        'gem-pulse': 'gem-pulse 2s ease-in-out infinite',
        'glow-breathe': 'glow-breathe 4s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'pulse-subtle': {
          '0%, 100%': { filter: 'brightness(1)' },
          '50%': { filter: 'brightness(1.3)' },
        },
        'gem-pulse': {
          '0%, 100%': {
            boxShadow: '0 0 8px var(--gem-glow, rgba(251,191,36,0.4)), inset 0 -2px 4px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.15)',
          },
          '50%': {
            boxShadow: '0 0 16px var(--gem-glow, rgba(251,191,36,0.6)), inset 0 -2px 4px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.2)',
          },
        },
        'glow-breathe': {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.6' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config
