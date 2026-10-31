import type { Trip } from '@venzini/contracts';
import { useMe, useTrips } from '@/api/hooks';
import { RouteTabs, type TabItem } from '@/components/ui/tabs';
import { useDayStore } from '@/stores/day';

/** Trips still to record: not yet returned and not cancelled. */
export const toRecord = (trips: Trip[]) =>
  trips.filter((t) => t.trip_status === 'planned' || t.trip_status === 'departed');

/** UI-04 tabs (SDD 5.12.3). The dispatcher also has the warehouse forecast (D-17). */
export function ResourcesTabs() {
  const { data: me } = useMe();
  const day = useDayStore((s) => s.day);
  const trips = useTrips(day);
  const items: TabItem[] = [
    { label: 'Resources', to: '/resources' },
    {
      label: 'Trips',
      to: '/resources/trips',
      badge: toRecord(trips.data?.items ?? []).length || undefined,
    },
  ];
  if (me?.user.role === 'dispatcher')
    items.push({ label: 'Warehouse forecast', to: '/resources/warehouse-forecast' });
  return <RouteTabs label="Resources views" items={items} />;
}
