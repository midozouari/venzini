import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/api/queryClient';
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Outlet, RouterProvider, type RouteObject } from 'react-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { NotFound, Placeholder } from '@/pages/Placeholder';
import { PageLoading } from '@/components/ui/states';
import { ErrorBoundary } from './ErrorBoundary';
import { HomeRedirect, RequireRole, RequireSession } from './guards';
import { IdleWatcher } from './IdleWatcher';
import { SCREENS } from './routes';
import { Shell } from './Shell';

// Every page is its own chunk, loaded when its route opens (NFR-02, SDD 5.10.1).
const StationsPage = lazy(() =>
  import('@/pages/admin/StationsPage').then((m) => ({ default: m.StationsPage })),
);
const UsersPage = lazy(() =>
  import('@/pages/admin/UsersPage').then((m) => ({ default: m.UsersPage })),
);
const ApprovalsPage = lazy(() =>
  import('@/pages/approvals/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })),
);
const HistoryPage = lazy(() =>
  import('@/pages/history/HistoryPage').then((m) => ({ default: m.HistoryPage })),
);
const LoginPage = lazy(() =>
  import('@/pages/login/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const ForecastPage = lazy(() =>
  import('@/pages/forecast/ForecastPage').then((m) => ({ default: m.ForecastPage })),
);
const TotalsPage = lazy(() =>
  import('@/pages/forecast/TotalsPage').then((m) => ({ default: m.TotalsPage })),
);
const NetworkPage = lazy(() =>
  import('@/pages/network/NetworkPage').then((m) => ({ default: m.NetworkPage })),
);
const PlannerPage = lazy(() =>
  import('@/pages/planner/PlannerPage').then((m) => ({ default: m.PlannerPage })),
);
const ResourcesPage = lazy(() =>
  import('@/pages/resources/ResourcesPage').then((m) => ({ default: m.ResourcesPage })),
);
const TripsPage = lazy(() =>
  import('@/pages/resources/TripsPage').then((m) => ({ default: m.TripsPage })),
);
const WarehouseForecastPage = lazy(() =>
  import('@/pages/resources/WarehouseForecastPage').then((m) => ({
    default: m.WarehouseForecastPage,
  })),
);

const BUILT: Record<string, React.ReactNode> = {
  '/network': <NetworkPage />,
  '/forecast': <ForecastPage />,
  '/forecast/totals': <TotalsPage />,
  '/resources': <ResourcesPage />,
  '/resources/trips': <TripsPage />,
  '/resources/warehouse-forecast': <WarehouseForecastPage />,
  '/planner': <PlannerPage />,
  '/approvals': <ApprovalsPage />,
  '/history': <HistoryPage />,
  '/admin/users': <UsersPage />,
  '/admin/stations': <StationsPage />,
};

function SessionLayout() {
  return (
    <>
      <IdleWatcher />
      <Shell />
    </>
  );
}

// The hidden developer toolbar exists only in MVP builds: v1 builds drop this import (SDD 7.1).
const DevTools =
  import.meta.env.VITE_USE_MOCKS === 'true'
    ? lazy(() => import('@/features/dev/DevTools').then((m) => ({ default: m.DevTools })))
    : null;

function Root() {
  return (
    <>
      <Outlet />
      {DevTools ? (
        <Suspense fallback={null}>
          <DevTools />
        </Suspense>
      ) : null}
    </>
  );
}

const appRoutes: RouteObject[] = [
  {
    path: '/login',
    element: (
      <Suspense fallback={null}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    element: <RequireSession />,
    children: [
      {
        element: <SessionLayout />,
        children: [
          { index: true, element: <HomeRedirect /> },
          { path: '/admin', element: <HomeRedirect admin /> },
          ...SCREENS.filter((s) => !s.servedBy).map((s) => ({
            path: s.routePath ?? s.path,
            element: (
              <ErrorBoundary key={s.path}>
                <RequireRole roles={s.roles}>
                  <Suspense fallback={<PageLoading />}>{BUILT[s.path] ?? <Placeholder />}</Suspense>
                </RequireRole>
              </ErrorBoundary>
            ),
          })),
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
];

export const routes: RouteObject[] = [{ element: <Root />, children: appRoutes }];

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
