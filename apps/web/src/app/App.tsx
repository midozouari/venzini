import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/api/queryClient';
import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApprovalsPage } from '@/pages/approvals/ApprovalsPage';
import { LoginPage } from '@/pages/login/LoginPage';
import { ForecastPage } from '@/pages/forecast/ForecastPage';
import { TotalsPage } from '@/pages/forecast/TotalsPage';
import { NetworkPage } from '@/pages/network/NetworkPage';
import { PlannerPage } from '@/pages/planner/PlannerPage';
import { ResourcesPage } from '@/pages/resources/ResourcesPage';
import { TripsPage } from '@/pages/resources/TripsPage';
import { WarehouseForecastPage } from '@/pages/resources/WarehouseForecastPage';
import { NotFound, Placeholder } from '@/pages/Placeholder';
import { ErrorBoundary } from './ErrorBoundary';
import { HomeRedirect, RequireRole, RequireSession } from './guards';
import { IdleWatcher } from './IdleWatcher';
import { SCREENS } from './routes';
import { Shell } from './Shell';

const BUILT: Record<string, React.ReactNode> = {
  '/network': <NetworkPage />,
  '/forecast': <ForecastPage />,
  '/forecast/totals': <TotalsPage />,
  '/resources': <ResourcesPage />,
  '/resources/trips': <TripsPage />,
  '/resources/warehouse-forecast': <WarehouseForecastPage />,
  '/planner': <PlannerPage />,
  '/approvals': <ApprovalsPage />,
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
