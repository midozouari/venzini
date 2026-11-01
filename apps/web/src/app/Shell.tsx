// Layout shell (SDD 5.12.1): the fixed navy canvas (body), with a floating navigation panel and a
// floating top bar above it.
import { ROLE_HOME } from '@venzini/contracts';
import { LogOut, Wrench } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useLogout, useMe, usePlanOfDay } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { DayPicker } from '@/components/ui/day-picker';
import { PlanStatusChip } from '@/components/ui/status-chip';
import { ROLE_LABEL } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useDayStore } from '@/stores/day';
import { useDevStore } from '@/stores/dev';
import { MENU, screenFor } from './routes';

export function Shell() {
  const { data: me } = useMe();
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useLogout();
  const day = useDayStore((s) => s.day);
  const screen = screenFor(location.pathname);
  const isManager = me?.user.role === 'manager';
  const plan = usePlanOfDay(day, isManager && !!screen?.day);
  const devNote = useDevStore((s) => s.note);
  const openDev = useDevStore((s) => s.setOpen);
  if (!me) return null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Base canvas: each screen fills it (the map on map screens). */}
      <div className="absolute inset-0 isolate z-0">
        <Outlet />
      </div>

      <nav
        aria-label="Main"
        className="absolute bottom-[var(--vz-gap)] left-[var(--vz-gap)] top-[var(--vz-gap)] z-30 flex w-[var(--vz-nav-width)] flex-col rounded-panel border border-line bg-panel p-4 shadow-float animate-in fade-in-0 slide-in-from-left-2 duration-300"
      >
        <a href={ROLE_HOME[me.user.role]} className="mb-8 block rounded-control px-2 pt-2">
          <img src="/logo.png" alt="Venzini" className="h-auto w-full" />
        </a>
        <ul className="flex flex-col gap-1">
          {me.pages.map((page) => {
            const item = MENU[page];
            const Icon = item.icon;
            return (
              <li key={page}>
                <NavLink
                  to={item.path}
                  end={item.path === '/resources'}
                  className={({ isActive }) =>
                    cn(
                      'flex h-10 items-center gap-3 rounded-control px-3 text-body transition-[background-color,color,transform] duration-150 ease-vz active:scale-[0.98]',
                      isActive
                        ? 'bg-navy-tint-strong font-semibold text-ink'
                        : 'text-muted hover:bg-navy-tint hover:text-ink',
                    )
                  }
                >
                  <Icon aria-hidden className="size-[18px]" />
                  {item.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto border-t border-line pt-4">
          <Button
            variant="quiet"
            className="w-full justify-start px-3"
            onClick={() =>
              logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
            }
          >
            <LogOut aria-hidden />
            Log out
          </Button>
        </div>
      </nav>

      <header className="absolute left-[var(--vz-safe-left)] right-[var(--vz-gap)] top-[var(--vz-gap)] z-30 flex h-[var(--vz-topbar-height)] items-center gap-4 rounded-panel border border-line bg-panel px-6 shadow-float animate-in fade-in-0 slide-in-from-top-2 duration-300">
        <h1 className="text-section text-ink">{screen?.title ?? 'Venzini'}</h1>
        {screen?.day ? (
          <div className="ml-4 flex items-center gap-3">
            <DayPicker />
            {isManager ? <PlanStatusChip status={plan.data?.plan.status ?? null} /> : null}
          </div>
        ) : null}
        {devNote ? (
          <button
            type="button"
            onClick={() => openDev(true)}
            className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 text-caption font-semibold text-ink transition-[background-color,transform] duration-150 ease-vz hover:bg-navy-tint active:scale-[0.98]"
          >
            <Wrench aria-hidden className="size-3.5" />
            Dev: {devNote}
          </button>
        ) : null}
        <div className={cn('text-right', !devNote && 'ml-auto')}>
          <p className="text-body font-semibold leading-tight text-ink">{me.user.full_name}</p>
          <p className="text-caption text-muted">{ROLE_LABEL[me.user.role]}</p>
        </div>
      </header>
    </div>
  );
}

/** Content area of every screen: the space beside the floating navigation and top bar. */
export function ContentArea({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        'absolute inset-0 overflow-auto pb-[var(--vz-gap)] pl-[var(--vz-safe-left)] pr-[var(--vz-gap)] pt-[var(--vz-safe-top)]',
        // Scrolled content disappears at the top bar's lower edge, not in the gap above it.
        '[clip-path:inset(calc(var(--vz-safe-top)-var(--vz-gap))_0_0_0)]',
        className,
      )}
    >
      {children}
    </main>
  );
}
