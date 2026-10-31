import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('shows the Venzini logo with its alt text', () => {
    render(<App />);
    expect(screen.getByRole('img', { name: 'Venzini' })).toHaveAttribute('src', '/logo.png');
  });
});
