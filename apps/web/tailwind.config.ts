import type { Config } from 'tailwindcss';

// Venzini design system v1 (SDD 5.12.4, Figure 42) with the approved warm palette. Every value
// is a CSS variable from src/index.css; components use these names and never raw hex values.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: 'var(--vz-navy-900)',
          700: 'var(--vz-navy-700)',
          tint: 'var(--vz-navy-tint)',
          'tint-strong': 'var(--vz-navy-tint-strong)',
        },
        focus: 'var(--vz-focus)',
        cream: 'var(--vz-cream)',
        // Text placed directly on the navy canvas.
        'on-navy': 'var(--vz-cream)',
        panel: 'var(--vz-panel)',
        line: { DEFAULT: 'var(--vz-line)', strong: 'var(--vz-line-strong)' },
        ink: 'var(--vz-ink)',
        muted: 'var(--vz-muted)',
        // Reserved for risk only (BR-09, BR-10); always paired with an icon or a word (NFR-10).
        risk: {
          high: 'var(--vz-risk-high)',
          medium: 'var(--vz-risk-medium)',
          low: 'var(--vz-risk-low)',
          'medium-ink': 'var(--vz-risk-medium-ink)',
          'high-tint': 'var(--vz-risk-high-tint)',
          'medium-tint': 'var(--vz-risk-medium-tint)',
          'low-tint': 'var(--vz-risk-low-tint)',
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
        title: ['28px', { lineHeight: '36px', fontWeight: '700' }],
        section: ['20px', { lineHeight: '28px', fontWeight: '600' }],
        body: ['15px', { lineHeight: '22px', fontWeight: '400' }],
        caption: ['13px', { lineHeight: '18px', fontWeight: '400' }],
        kpi: ['34px', { lineHeight: '40px', fontWeight: '600' }],
      },
      borderRadius: {
        control: 'var(--vz-radius-control)',
        panel: 'var(--vz-radius-panel)',
        dialog: 'var(--vz-radius-dialog)',
      },
      boxShadow: {
        panel: 'var(--vz-shadow-panel)',
        float: 'var(--vz-shadow-float)',
        dialog: 'var(--vz-shadow-dialog)',
      },
      transitionTimingFunction: { vz: 'var(--vz-ease)' },
    },
  },
} satisfies Config;
