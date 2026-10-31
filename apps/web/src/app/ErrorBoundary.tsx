// One error boundary per page (SDD 6.2): "Something went wrong", Reload and the correlation ID.
import { RefreshCw } from 'lucide-react';
import { Component, type ReactNode } from 'react';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/states';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const correlation = error instanceof ApiError ? error.correlationId : undefined;
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Panel className="w-[480px]">
          <EmptyState
            icon={RefreshCw}
            title="Something went wrong"
            action={<Button onClick={() => window.location.reload()}>Reload</Button>}
          >
            {error instanceof ApiError ? error.message : 'The page could not be shown.'}
            {correlation ? (
              <span className="mt-3 block text-caption">Reference: {correlation}</span>
            ) : null}
          </EmptyState>
        </Panel>
      </div>
    );
  }
}
