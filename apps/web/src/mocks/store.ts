// In-memory state of the mock API (SDD 7.1): filled from the fixtures at start, changed by what
// the user does, and reset when the page reloads (AC-21). Nothing is saved.
import type {
  DecisionEntry,
  Limits,
  PlanView,
  Resources,
  Role,
  Station,
  Trip,
} from '@venzini/contracts';
import { DEMO_PASSWORD } from '@venzini/sample-data';
import { nowMs, resetClock } from './clock';
import { fixtures } from './fixtures';

export interface UserRecord {
  id: string;
  full_name: string;
  login: string;
  role: Role;
  status: 'active' | 'inactive';
  created_at: string;
  password: string;
  locked_until: number | null;
  failures: number[];
}

export interface PlanRecord {
  view: PlanView;
  limits: Record<string, Limits>;
}

export interface EditRecord {
  edit_id: string;
  kind: 'reorder' | 'move' | 'quantity' | 'reset';
  at: string;
  summary: string;
}

export interface DayPlan {
  /** The plan shown for the day. */
  current: PlanRecord;
  /** The optimal plan the current one is compared with (FR-43, FR-60). */
  baseline: PlanRecord;
  /** True while the current plan is the untouched fixture optimal plan: scripted edits apply. */
  scriptBase: boolean;
  /** Re-plans of SDD 7.2 already used (each applies once). */
  usedReplans: Set<string>;
  /** Stations rejected so far today. */
  rejected: Set<string>;
  /** Edits since the baseline (FR-72 "edits performed"). */
  edits: EditRecord[];
}

const clone = <T>(v: T): T => structuredClone(v);

function initialState() {
  return {
    sessionUserId: null as string | null,
    users: fixtures.users.map<UserRecord>((u) => ({
      id: u.id,
      full_name: u.full_name,
      login: u.login,
      role: u.role,
      status: u.status,
      created_at: u.created_at,
      password: DEMO_PASSWORD,
      locked_until: u.locked_for_min === null ? null : nowMs() + u.locked_for_min * 60_000,
      failures: [],
    })),
    stations: clone(fixtures.stations) as Station[],
    resources: clone(fixtures.resources) as Record<string, Resources>,
    trips: clone(fixtures.trips) as Trip[],
    decisions: clone(fixtures.decisions) as DecisionEntry[],
    plans: new Map<string, DayPlan>(),
    /** Every plan generated in the session, by ID (API-12). */
    planArchive: new Map<string, PlanView>(),
    counters: { plan: 2212, rv: 193, edit: 1, stop: 100 },
  };
}

type State = ReturnType<typeof initialState>;

class Store {
  state: State = initialState();

  reset(): void {
    resetClock();
    this.state = initialState();
  }

  currentUser(): UserRecord | null {
    const id = this.state.sessionUserId;
    const user = id ? this.state.users.find((u) => u.id === id) : undefined;
    return user && user.status === 'active' ? user : null;
  }

  nextPlanId(): string {
    return `PL-${this.state.counters.plan++}`;
  }

  nextEditId(): string {
    return `E-${String(this.state.counters.edit++).padStart(3, '0')}`;
  }

  nextResourceVersionId(): string {
    return `RV-${String(this.state.counters.rv++).padStart(4, '0')}`;
  }

  archive(view: PlanView): void {
    this.state.planArchive.set(view.plan.plan_id, clone(view));
  }
}

export const store = new Store();
export { clone };
