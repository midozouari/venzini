// UI-04 Warehouse forecast tab (FR-85, D-17): per-warehouse totals only, read-only.
import { ContentArea } from '@/app/Shell';
import { TotalsView } from '@/features/forecast/TotalsView';
import { ResourcesTabs } from './ResourcesTabs';

export function WarehouseForecastPage() {
  return (
    <ContentArea>
      <TotalsView levels={['warehouse']} header={<ResourcesTabs />} />
    </ContentArea>
  );
}
