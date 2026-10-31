// UI-03 Totals tab (FR-85): network and per-warehouse daily totals for the manager.
import { ContentArea } from '@/app/Shell';
import { TotalsView } from '@/features/forecast/TotalsView';
import { ForecastTabs } from './ForecastTabs';

export function TotalsPage() {
  return (
    <ContentArea>
      <TotalsView levels={['network', 'warehouse']} header={<ForecastTabs />} />
    </ContentArea>
  );
}
