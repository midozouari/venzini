import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createQueryClient } from '@/api/queryClient';
import { server } from '@/mocks/node';
import { store } from '@/mocks/store';
import { LoginPage } from './LoginPage';

function renderLogin(path = '/login') {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/network', element: <p>Network home</p> },
      { path: '/resources', element: <p>Resources home</p> },
      { path: '/admin/stations', element: <p>Stations screen</p> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeAll(() => server.listen({ onUnhandledFrame: 'bypass' }));
afterAll(() => server.close());
beforeEach(() => store.reset());

describe('Login (UI-01, UC-01)', () => {
  it('shows the logo and asks for both fields', async () => {
    renderLogin();
    expect(screen.getByRole('img', { name: 'Venzini' })).toHaveAttribute('src', '/logo.png');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Login is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
  });

  it('shows ERR-AUTH-01 for a wrong password and stays on the page', async () => {
    renderLogin();
    await userEvent.type(screen.getByLabelText('Login'), 'sara.m');
    await userEvent.type(screen.getByLabelText('Password'), 'not-the-password');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Login or password is incorrect.')).toBeInTheDocument();
  });

  it('opens the home page of the role', async () => {
    const router = renderLogin();
    await userEvent.type(screen.getByLabelText('Login'), 'karim.b');
    await userEvent.type(screen.getByLabelText('Password'), 'venzini-demo');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Resources home')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/resources');
  });

  it('returns to the requested page when the role allows it (FR-01)', async () => {
    renderLogin('/login?next=%2Fadmin%2Fstations');
    await userEvent.type(screen.getByLabelText('Login'), 'sara.m');
    await userEvent.type(screen.getByLabelText('Password'), 'venzini-demo');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Stations screen')).toBeInTheDocument();
  });

  it('can show the password', async () => {
    renderLogin();
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
  });
});
