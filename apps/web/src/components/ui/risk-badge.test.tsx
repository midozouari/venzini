import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RiskBadge } from './risk-badge';

describe('RiskBadge (FR-48, NFR-10)', () => {
  it('shows a word and an icon, never color alone', () => {
    const { container } = render(<RiskBadge level="medium" suffix="40 h" />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.textContent).toContain('40 h');
  });
});
