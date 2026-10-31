import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/api/queryClient';
import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LoginPage } from '@/pages/login/LoginPage';
import { NetworkPage } from '@/pages/network/NetworkPage';
import { NotFound, Placeholder } from '@/pages/Placeholder';
import { ErrorBoundary } from './ErrorBoundary';
import { HomeRedirect, RequireRole, RequireSession } from './guards';
import { IdleWatcher } from './IdleWatcher';
import { SCREENS } from './routes';
import { Shell } from './Shell';

const BUILT: Record<string, React.ReactNode> = {
  '/network': <NetworkPage />,
};

function SessionLayout() {
  return (
    <>
      <IdleWatcher />
      <Shell />
    </>
  );
}

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireSession />,
    children: [
      {
        element: <SessionLayout />,
        children: [
          { index: true, element: <HomeRedirect /> },
          { path: '/admin', element: <HomeRedirect admin /> },
          ...SCREENS.map((s) => ({
            path: s.path,
            element: (
              <ErrorBoundary key={s.path}>
                <RequireRole roles={s.roles}>{BUILT[s.path] ?? <Placeholder />}</RequireRole>
              </ErrorBoundary>
            ),
          })),
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
];

const router = createBrowserRouter(routes);
const queryClient = createQueryClient();

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
