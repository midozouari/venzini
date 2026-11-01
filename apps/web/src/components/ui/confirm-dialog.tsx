import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './button';
import { Dialog, DialogActions, DialogContent, DialogDescription, DialogTitle } from './dialog';

/** Asks before an action that is hard to undo (SDD 5.12.6): Back, or the named action. */
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
        {error ? (
          <p role="alert" className="mt-4 text-caption font-medium text-risk-high">
            {error}
          </p>
        ) : null}
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
