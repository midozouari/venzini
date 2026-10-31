import { Compass, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useMe } from '@/api/hooks';
import { ContentArea } from '@/app/Shell';
import { screenFor } from '@/app/routes';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/states';

/** A calm stand-in for screens built in a later MVP step, so every menu item works. */
export function Placeholder() {
  const { pathname } = useLocation();
  const screen = screenFor(pathname);
  return (
    <ContentArea className="flex items-center justify-center">
      <Panel className="w-[520px] animate-in fade-in-0 zoom-in-[0.98] duration-200">
        <EmptyState icon={Sparkles} title={screen?.title ?? 'Coming soon'}>
          This screen arrives in Step {screen?.step ?? '2'} of the MVP.
        </EmptyState>
      </Panel>
    </ContentArea>
  );
}

export function NotFound() {
  const { data: me } = useMe();
  return (
    <ContentArea className="flex items-center justify-center">
      <Panel className="w-[480px]">
        <EmptyState
          icon={Compass}
          title="We couldn't find this page."
          action={
            <Button asChild>
              <Link to={me ? '/' : '/login'}>Go to my home page</Link>
            </Button>
          }
        />
      </Panel>
    </ContentArea>
  );
}
