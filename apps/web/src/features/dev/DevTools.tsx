// Hidden developer toolbar (MVP builds only, SDD 7.1): scenario sets, forced error responses, the
// set-up of the five README demo flows, and a reset of the demo data. Open it with Ctrl+Alt+D or
// by adding ?dev to the address. It changes only the in-browser mock API; nothing is saved.
import { PlanView } from '@venzini/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { Clapperboard, RotateCcw } from 'lucide-react';
import { useEffect, useReducer, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { request } from '@/api/client';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SidePanel } from '@/components/ui/side-panel';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  dev,
  FORCED_ERRORS,
  loadScenario,
  SCENARIOS,
  setForced,
  signInAs,
  type ScenarioId,
} from '@/mocks/dev';
import { fixtures } from '@/mocks/fixtures';
import { useDayStore } from '@/stores/day';
import { useDevStore } from '@/stores/dev';

const DEMO_DAY = fixtures.demo.default_delivery_day;

/** The five flows of the README "Demo script": each button prepares the scene only. */
export const DEMO_FLOWS = [
  {
    title: 'Move ST012 to T-02',
    path: '/planner?station=ST012',
    todo: 'Drag Westside Terminal (ST012) by its handle onto the T-02 card, or use ⇄ then Move to T-02.',
  },
  {
    title: 'Reorder on T-03',
    path: '/planner?station=ST003',
    todo: 'Drag La Marsa Corniche (ST003) onto Borj Louzir (ST005) in the T-03 card.',
  },
  {
    title: 'Reorder on T-01',
    path: '/planner?station=ST012',
    todo: 'Click ↓ on Westside Terminal (ST012).',
  },
  {
    title: 'Quantity above the limit',
    path: '/planner?station=ST012',
    todo: 'Click Edit quantity next to Petrol 95 and type 7000.',
  },
  {
    title: 'Reject ST014',
    path: '/approvals',
    todo: 'Click ✕ Reject on Harbor Road (ST014), then confirm.',
  },
] as const;

/** The top-bar note while the mock is not in its normal state. */
function note(): string | null {
  const parts: string[] = [];
  const scenario = SCENARIOS.find((s) => s.id === dev.scenario);
  if (scenario && scenario.id !== 'normal') parts.push(scenario.tag);
  parts.push(...dev.forced);
  return parts.length ? parts.join(' · ') : null;
}

export function DevTools() {
  const open = useDevStore((s) => s.open);
  const setOpen = useDevStore((s) => s.setOpen);
  const setNote = useDevStore((s) => s.setNote);
  const setDay = useDayStore((s) => s.setDay);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { search } = useLocation();
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [busy, setBusy] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Ctrl+Alt+D opens and closes the toolbar; "?dev" in the address opens it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.code === 'KeyD') {
        e.preventDefault();
        setOpen(!useDevStore.getState().open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);
  useEffect(() => {
    if (new URLSearchParams(search).has('dev')) setOpen(true);
  }, [search, setOpen]);

  /** After the mock data changed: every screen loads its data again. */
  const changed = async () => {
    setNote(note());
    rerender();
    await qc.resetQueries();
  };

  const chooseScenario = async (id: ScenarioId) => {
    setFailure(null);
    loadScenario(id);
    await changed();
  };

  const setUp = async (index: number) => {
    const flow = DEMO_FLOWS[index]!;
    setFailure(null);
    setBusy(index);
    try {
      // A fresh normal day, signed in as the manager, with the recommended plan generated.
      loadScenario('normal');
      signInAs('sara.m');
      setDay(DEMO_DAY);
      await request('POST', '/plans', { body: { delivery_day: DEMO_DAY }, schema: PlanView });
      await changed();
      setOpen(false);
      void navigate(flow.path);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
      await changed();
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    setConfirmReset(false);
    setFailure(null);
    loadScenario();
    await changed();
    setOpen(false);
    void navigate('/');
  };

  return (
    <>
      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="Developer tools"
        description="MVP only. These change the in-browser mock API; nothing is saved."
      >
        <div className="flex flex-col gap-7">
          <section aria-labelledby="dev-scenario">
            <h3 id="dev-scenario" className="mb-1 text-body font-semibold text-ink">
              Scenario
            </h3>
            <p className="mb-3 text-caption text-muted">
              Switching starts from fresh demo data; you stay signed in.
            </p>
            <div role="radiogroup" aria-labelledby="dev-scenario" className="flex flex-col gap-2">
              {SCENARIOS.map((s) => {
                const active = dev.scenario === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => void chooseScenario(s.id)}
                    className={cn(
                      'rounded-control border px-4 py-3 text-left transition-[background-color,border-color,transform] duration-150 ease-vz hover:-translate-y-px hover:bg-navy-tint active:scale-[0.98]',
                      active ? 'border-navy-900 bg-navy-tint' : 'border-line',
                    )}
                  >
                    <span className="flex items-center gap-2 text-body font-medium text-ink">
                      {s.label}
                      <span className="rounded-full bg-cream px-2 text-caption font-semibold text-muted">
                        {s.tag}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-caption text-muted">{s.description}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="dev-errors" className="border-t border-line pt-5">
            <h3 id="dev-errors" className="mb-1 text-body font-semibold text-ink">
              Forced errors
            </h3>
            <p className="mb-3 text-caption text-muted">
              While on, the API answers with this error, to show each error state.
            </p>
            <ul className="flex flex-col gap-3">
              {FORCED_ERRORS.map((f) => (
                <li key={f.code} className="flex items-center justify-between gap-4">
                  <span>
                    <span className="block text-body font-medium text-ink">{f.code}</span>
                    <span className="block text-caption text-muted">{f.where}</span>
                  </span>
                  <Switch
                    label={`Force ${f.code}`}
                    checked={dev.forced.has(f.code)}
                    onChange={(on) => {
                      setForced(f.code, on);
                      setNote(note());
                      rerender();
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="dev-demo" className="border-t border-line pt-5">
            <h3 id="dev-demo" className="mb-1 text-body font-semibold text-ink">
              Demo flows
            </h3>
            <p className="mb-3 text-caption text-muted">
              Each button prepares the scene as sara.m with a fresh plan; you do the action.
            </p>
            <ol className="flex flex-col gap-3">
              {DEMO_FLOWS.map((flow, i) => (
                <li key={flow.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-cream text-caption font-semibold text-ink">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-medium text-ink">{flow.title}</span>
                    <span className="block text-caption text-muted">{flow.todo}</span>
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy !== null}
                    aria-label={`Set up demo ${i + 1}: ${flow.title}`}
                    onClick={() => void setUp(i)}
                  >
                    <Clapperboard aria-hidden />
                    {busy === i ? 'Setting up…' : 'Set up'}
                  </Button>
                </li>
              ))}
            </ol>
            {failure ? (
              <p role="alert" className="mt-3 text-caption font-medium text-risk-high">
                {failure}
              </p>
            ) : null}
          </section>

          <section className="flex items-center justify-between gap-4 border-t border-line pt-5">
            <p className="text-caption text-muted">Open or close with Ctrl+Alt+D.</p>
            <Button variant="secondary" onClick={() => setConfirmReset(true)}>
              <RotateCcw aria-hidden /> Reset demo data
            </Button>
          </section>
        </div>
      </SidePanel>

      {confirmReset ? (
        <ConfirmDialog
          title="Reset the demo data?"
          confirm="Reset"
          icon={RotateCcw}
          pending={false}
          onClose={() => setConfirmReset(false)}
          onConfirm={() => void reset()}
        >
          Everything done in this session (plans, decisions, saved resources, new users and
          stations) goes back to the sample data. You stay signed in.
        </ConfirmDialog>
      ) : null}
    </>
  );
}
