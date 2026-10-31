// Route guards (SDD 5.12.3): a guard reads GET /me; without a session the user goes to /login and
// comes back to the requested address after login, if the role allows it (FR-01).
import { ROLE_HOME, type Role } from '@venzini/contracts';
import { ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router';
import { ApiError } from '@/api/client';
import { useMe } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { ContentArea } from './Shell';

export function RequireSession() {
  const me = useMe();
  const location = useLocation();
  if (me.isPending)
    return (
      <div className="flex h-full items-center justify-center">
        <Skeleton className="h-40 w-96 rounded-panel" />
      </div>
    );
  if (me.error) {
    if (me.error instanceof ApiError && me.error.status === 401) {
      const next = `${location.pathname}${location.search}`;
      return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
    }
    throw me.error;
  }
  return <Outlet />;
}

/** Shows the screen only to the roles allowed on it; others get ERR-AUTH-04. */
export function RequireRole({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  const { data: me } = useMe();
  if (me && !roles.includes(me.user.role)) return <Forbidden home={ROLE_HOME[me.user.role]} />;
  return <>{children}</>;
}

export function Forbidden({ home }: { home: string }) {
  return (
    <ContentArea className="flex items-center justify-center">
      <Panel className="w-[480px] animate-in fade-in-0 zoom-in-[0.98] duration-200">
        <EmptyState
          icon={ShieldAlert}
          title="You don't have access to this page."
          action={
            <Button asChild>
              <Link to={home}>Go to my home page</Link>
            </Button>
          }
        >
          Your role does not include this screen.
        </EmptyState>
      </Panel>
    </ContentArea>
  );
}

/** "/" and "/admin" lead to the right page for the role. */
export function HomeRedirect({ admin = false }: { admin?: boolean }) {
  const { data: me } = useMe();
  if (!me) return null;
  if (admin)
    return <Navigate to={me.user.role === 'admin' ? '/admin/users' : '/admin/stations'} replace />;
  return <Navigate to={ROLE_HOME[me.user.role]} replace />;
}
