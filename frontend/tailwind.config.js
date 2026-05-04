/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        secondary: '#f1f5f9',
        success: '#10b981',
        warning: '#f59e0b',
        destructive: '#ef4444',
        muted: '#64748b',
        border: '#e2e8f0',
        background: '#f8fafc',
        card: '#ffffff',
        sidebar: '#0f172a',
        'sidebar-foreground': '#f8fafc',
      },
      spacing: {
        'text-sm': '0.875rem',
      },
    },
  },
  plugins: [],
}
