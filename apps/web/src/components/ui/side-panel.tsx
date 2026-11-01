import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

/**
 * A side panel that slides in from the right (layer 3, like a dialog): the app behind is blurred
 * and dimmed, focus is trapped inside and Escape closes it (SDD 5.12.6, UI-07 detail panel).
 */
export function SidePanel({
  open,
  onClose,
  title,
  description,
  children,
  onCloseAutoFocus,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  onCloseAutoFocus?: ComponentProps<typeof DialogPrimitive.Content>['onCloseAutoFocus'];
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-navy-900/25 backdrop-blur-[6px]',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150',
          )}
        />
        <DialogPrimitive.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(
            'fixed bottom-[var(--vz-gap)] right-[var(--vz-gap)] top-[var(--vz-gap)] z-50 flex w-[560px] max-w-[calc(100vw-40px)] flex-col',
            'rounded-dialog border border-line bg-panel shadow-dialog focus:outline-none',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-6 data-[state=open]:duration-250',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-6 data-[state=closed]:duration-150',
            className,
          )}
        >
          <div className="flex items-start gap-4 border-b border-line px-8 pb-5 pt-7">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-section text-ink">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description asChild>
                  <div className="mt-1.5 text-body text-muted">{description}</div>
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">
                  Details
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="quiet" size="icon" aria-label="Close" className="-mr-2 -mt-1">
                <X aria-hidden />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
