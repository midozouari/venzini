// Shared parts of UI-08 Administration: the tabs, the status chip, the confirmation of a
// (de)activation and the mapping of API errors to form fields.
import type { User } from '@venzini/contracts';
import { CircleCheck, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiError } from '@/api/client';
import { useMe } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { RouteTabs, type TabItem } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/** Users (admin) and Stations (admin and manager, D-15). */
export function AdminTabs() {
  const { data: me } = useMe();
  const items: TabItem[] = [];
  if (me?.can.manage_users) items.push({ label: 'Users', to: '/admin/users' });
  if (me?.can.manage_stations) items.push({ label: 'Stations', to: '/admin/stations' });
  return <RouteTabs label="Administration views" items={items} />;
}

/** Active or inactive; navy and neutral only. */
export function RecordStatusChip({ status }: { status: User['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-caption font-semibold',
        status === 'active'
          ? 'bg-navy-tint-strong text-ink'
          : 'border border-dashed border-line-strong/70 text-muted',
      )}
    >
      {status === 'active' ? 'Active' : 'Inactive'}
    </span>
  );
}

export type Result = { tone: 'status' | 'alert'; text: string } | null;

/** The confirmation message after a change (UI-08 system responses). */
export function ResultNote({ result }: { result: Result }) {
  if (!result) return null;
  return (
    <Callout
      icon={result.tone === 'status' ? CircleCheck : TriangleAlert}
      role={result.tone}
      className="animate-in fade-in-0 duration-200"
    >
      {result.text}
    </Callout>
  );
}

/** Errors of a form: the field the API named, or the whole form. */
export function formErrors(error: unknown): { fields: Record<string, string>; form?: string } {
  if (!error) return { fields: {} };
  if (error instanceof ApiError && error.field) return { fields: { [error.field]: error.message } };
  return { fields: {}, form: error instanceof Error ? error.message : String(error) };
}

export function FormError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="mt-4 text-caption font-medium text-risk-high">
      {message}
    </p>
  ) : null;
}

/** Deactivation asks first: it ends sessions or hides a station from the map (SDD 5.12.6). */
export function ConfirmDialog({
  title,
  children,
  confirm,
  icon: Icon,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirm: string;
  icon: LucideIcon;
  pending: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription asChild>
          <div>{children}</div>
        </DialogDescription>
        <FormError message={error} />
        <DialogActions>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Back
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            <Icon aria-hidden />
            {pending ? 'Saving…' : confirm}
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
