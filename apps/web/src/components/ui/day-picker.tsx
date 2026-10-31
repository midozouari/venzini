import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDayLong } from '@/lib/format';
import { useDayStore } from '@/stores/day';
import { Button } from './button';

/** Delivery-day picker of the top bar (SDD 5.12.1). */
export function DayPicker() {
  const { day, shift } = useDayStore();
  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-cream/60 p-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-full"
        aria-label="Previous day"
        onClick={() => shift(-1)}
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-36 px-1 text-center text-body font-medium text-ink" aria-live="polite">
        <span className="sr-only">Delivery day: </span>
        {formatDayLong(day)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-full"
        aria-label="Next day"
        onClick={() => shift(1)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
