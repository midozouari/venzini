import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { Check, ChevronDown, Search } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface PickerStation {
  station_id: string;
  name: string;
  region: string;
}

/**
 * A searchable station picker (combobox): a pill button that opens a floating list with a search
 * box. Typing matches the ID, the name or the region; ↑ ↓ move, Enter picks, Escape closes.
 */
export function StationPicker({
  stations,
  value,
  onChange,
  label = 'Station',
  className,
}: {
  stations: PickerStation[];
  value: string | null;
  onChange: (stationId: string) => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = stations.find((s) => s.station_id === value);
  const regions = [...new Set(stations.map((s) => s.region))];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`${label}: ${current ? `${current.name} (${current.station_id})` : 'none'}`}
        className={cn(
          'inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-panel pl-4 pr-3 text-left text-body text-ink',
          'transition-[border-color,box-shadow,transform] duration-150 ease-vz hover:-translate-y-px hover:border-navy-900 hover:shadow-panel active:scale-[0.98]',
          'data-[state=open]:border-navy-900 data-[state=open]:shadow-[0_0_0_4px_var(--vz-navy-tint-strong)]',
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {current ? (
            <>
              <span className="font-semibold">{current.station_id}</span> {current.name}
            </>
          ) : (
            <span className="text-muted">Choose a station</span>
          )}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 shrink-0 text-muted transition-transform duration-200 ease-vz',
            open && 'rotate-180',
          )}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          className={cn(
            'z-50 w-[340px] overflow-hidden rounded-panel border border-line bg-panel shadow-float',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 data-[state=open]:duration-200',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150',
          )}
        >
          <Command
            label={`${label} list`}
            filter={(itemValue, search) =>
              itemValue.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0
            }
          >
            <div className="flex items-center gap-2 border-b border-line px-4 transition-shadow duration-150 ease-vz focus-within:shadow-[inset_0_-2px_0_var(--vz-navy-900)]">
              <Search aria-hidden className="size-4 shrink-0 text-muted" />
              <Command.Input
                placeholder="Search by ID, name or region"
                className="h-11 w-full bg-transparent text-body text-ink outline-none placeholder:text-muted focus-visible:outline-none"
              />
            </div>
            <Command.List className="max-h-[320px] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-6 text-center text-body text-muted">
                No station matches.
              </Command.Empty>
              {regions.map((region) => (
                <Command.Group
                  key={region}
                  heading={region}
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted"
                >
                  {stations
                    .filter((s) => s.region === region)
                    .map((s) => (
                      <Command.Item
                        key={s.station_id}
                        value={`${s.station_id} ${s.name} ${s.region}`}
                        onSelect={() => {
                          onChange(s.station_id);
                          setOpen(false);
                        }}
                        className="flex cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-body text-ink transition-colors duration-150 data-[selected=true]:bg-navy-tint"
                      >
                        <span className="w-12 shrink-0 font-semibold tabular-nums">
                          {s.station_id}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{s.name}</span>
                        {s.station_id === value ? (
                          <Check aria-label="Selected" className="size-4 shrink-0" />
                        ) : null}
                      </Command.Item>
                    ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
