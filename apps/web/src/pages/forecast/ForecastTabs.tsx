import { RouteTabs } from '@/components/ui/tabs';

/** UI-03 tabs: station forecast and totals (SDD 5.12.3: /forecast, /forecast/totals). */
export function ForecastTabs() {
  return (
    <RouteTabs
      label="Forecast views"
      items={[
        { label: 'Station forecast', to: '/forecast' },
        { label: 'Totals', to: '/forecast/totals' },
      ]}
    />
  );
}
