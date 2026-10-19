/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Colour names used in the components. The actual values (light and dark) are in src/styles/globals.css.
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        ink: 'var(--text)',
        muted: 'var(--muted)',
        line: 'var(--border)',
        accent: 'var(--accent)',
        'accent-text': 'var(--accent-text)',
        focus: 'var(--focus)',
        skeleton: 'var(--skeleton)',
        uber: { DEFAULT: 'var(--uber)', bg: 'var(--uber-bg)' },
        doordash: { DEFAULT: 'var(--doordash)', bg: 'var(--doordash-bg)' },
        status: {
          new: 'var(--s-new)',
          'new-bg': 'var(--s-new-bg)',
          accepted: 'var(--s-accepted)',
          'accepted-bg': 'var(--s-accepted-bg)',
          preparing: 'var(--s-preparing)',
          'preparing-bg': 'var(--s-preparing-bg)',
          ready: 'var(--s-ready)',
          'ready-bg': 'var(--s-ready-bg)',
          completed: 'var(--s-completed)',
          'completed-bg': 'var(--s-completed-bg)',
          cancelled: 'var(--s-cancelled)',
          'cancelled-bg': 'var(--s-cancelled-bg)',
        },
      },
    },
  },
  plugins: [],
};
