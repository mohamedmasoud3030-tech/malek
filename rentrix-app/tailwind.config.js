/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius-card)',
        '2xl': 'calc(var(--radius-elevated))',
      },
      colors: {
        primary: {
          DEFAULT: 'hsl(var(--color-primary))',
          fg: 'hsl(var(--color-primary-fg))',
        },
        'primary-fg': 'hsl(var(--color-primary-fg))',
        background: 'hsl(var(--color-bg))',
        card: 'hsl(var(--color-card))',
        border: 'hsl(var(--color-border))',
        text: {
          DEFAULT: 'hsl(var(--color-text-primary))',
          muted: 'hsl(var(--color-text-muted))',
        },
        sidebar: {
          bg: 'hsl(var(--color-sidebar-bg))',
          text: 'hsl(var(--color-sidebar-text))',
          'active-bg': 'hsl(var(--color-sidebar-active-bg))',
          'hover-bg': 'hsl(var(--color-sidebar-hover-bg))',
          'active-text': 'hsl(var(--color-sidebar-active-text))',
        },
        success: { text: 'hsl(var(--color-success-text))', bg: 'hsl(var(--color-success-bg))' },
        warning: { text: 'hsl(var(--color-warning-text))', bg: 'hsl(var(--color-warning-bg))' },
        danger: { text: 'hsl(var(--color-danger-text))', bg: 'hsl(var(--color-danger-bg))' },
        info: { text: 'hsl(var(--color-info-text))', bg: 'hsl(var(--color-info-bg))' },
        neutral: { text: 'hsl(var(--color-neutral-text))', bg: 'hsl(var(--color-neutral-bg))' },
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        elevated: 'var(--shadow-elevated)',
        sidebar: 'var(--shadow-sidebar)',
      },
      transitionDuration: {
        '250': '250ms',
        '300': '300ms',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
