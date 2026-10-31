import type { Config } from 'tailwindcss';

// Venzini design system v1 (SDD 5.12.4, Figure 42). Every color is a CSS variable defined in
// src/index.css; components use these token names and never raw hex values.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 900: 'var(--vz-navy-900)', 700: 'var(--vz-navy-700)' },
        focus: 'var(--vz-focus)',
        gray: {
          900: 'var(--vz-gray-900)',
          600: 'var(--vz-gray-600)',
          300: 'var(--vz-gray-300)',
          50: 'var(--vz-gray-50)',
        },
        // Reserved for risk only (BR-09, BR-10); always paired with an icon or a word (NFR-10).
        risk: {
          high: 'var(--vz-risk-high)',
          medium: 'var(--vz-risk-medium)',
          low: 'var(--vz-risk-low)',
        },
        // Route lines, one per tanker in ID order; never red, orange or green (FR-53, BR-10).
        route: {
          1: 'var(--vz-route-1)',
          2: 'var(--vz-route-2)',
          3: 'var(--vz-route-3)',
          4: 'var(--vz-route-4)',
          5: 'var(--vz-route-5)',
          6: 'var(--vz-route-6)',
          7: 'var(--vz-route-7)',
          8: 'var(--vz-route-8)',
        },
      },
      fontFamily: { sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'] },
      fontSize: {
        title: ['28px', { fontWeight: '700' }],
        section: ['20px', { fontWeight: '600' }],
        body: ['15px', { fontWeight: '400' }],
        caption: ['13px', { fontWeight: '400' }],
      },
      borderRadius: { card: '8px' },
    },
  },
} satisfies Config;
