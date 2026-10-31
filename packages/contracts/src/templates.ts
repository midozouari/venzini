// Fixed explanation sentences with typed blanks (ALG-08, D-11). No text is generated.

export const TEMPLATE_CATALOG_VERSION = 'tpl-1.1.0';

export const TEMPLATES = {
  'TPL-FC-01': 'Recent {fuel} sales average {litres} per day on {weekday}s.',
  'TPL-FC-02': '{month} demand is usually {pct} {higher_lower} than average.',
  'TPL-FC-03': '{condition} weather ({temp} °C) on {date} {raises_lowers} demand by {pct}.',
  'TPL-FC-04': '{event} on {date} raises expected demand by {pct}.',
  'TPL-FC-05': '{holiday} on {date} changes demand by {pct}.',
  'TPL-FC-06': 'Deliveries in the last 28 days were {pct} {above_below} sales.',
  'TPL-FC-07': 'Current stock ({litres}) runs out on {date} if no delivery arrives.',
  'TPL-FC-08': 'Confidence is {pct}: {missing_input} is missing for {days} of 7 days.',
  'TPL-FC-09':
    'Little sales history for {station} {fuel}: forecast based on similar stations, confidence {pct}.',
  'TPL-RISK-H':
    '{station} is high risk: current {fuel} stock covers {hours} hours of forecast demand.',
  'TPL-RISK-M':
    '{station} is medium risk: current {fuel} stock covers {hours} hours of forecast demand.',
  'TPL-RISK-L': '{station} is low risk: current {fuel} stock lasts more than 3 days.',
  'TPL-PRI-01': 'Priority {rank}: {level} risk, {hours} hours to stockout, needs {litres}.',
  'TPL-UNS-01': "{station} is not served today: {reason}. It moves up in tomorrow's plan.",
  'TPL-FB-01': '{station} gets {fuel} from {warehouse} today: {nearest} has none left.',
  'TPL-TRIP-01': 'Plan for {date} decided: {n} trips to record.',
  'TPL-TRIP-02': 'Tanker {tanker} makes a second trip, leaving at {time} after reloading.',
  'TPL-TRIP-03': 'Trip {trip} cancelled: {reason}.',
  'TPL-EDIT-01':
    'Tanker {tanker} is overloaded: {load} on a {capacity} tanker. Remove {excess} before approving.',
  'TPL-EDIT-02': '{station} may run out of {fuel} {minutes} min before the tanker arrives.',
  'TPL-EDIT-03': '{station} would be reached at {time}, outside its {open}–{close} window.',
  'TPL-EDIT-04': 'This change makes {station} arrive {minutes} min later than planned.',
  'TPL-EDIT-05': 'This change adds {amount} ({pct}) of distance to the plan.',
  'TPL-EDIT-06': 'This change adds {amount} ({pct}) of time to the plan.',
  'TPL-EDIT-07': 'This change adds {amount} ({pct}) of cost to the plan.',
  'TPL-WHY-01': 'The recommended plan was {usd} cheaper and {km} shorter.',
  'TPL-LIM-01': 'Max for this stop: {max}. {limit_detail}.',
} as const;

export type TemplateId = keyof typeof TEMPLATES;

/** FR-66: shown when an edit creates no risk. */
export const NO_RISK_MESSAGE =
  'No risk: this change keeps all deliveries on time and within limits.';

/** Fills a template. Every blank must be given a value (ALG-08: never invented). */
export function fillTemplate(id: TemplateId, values: Record<string, string | number>): string {
  return TEMPLATES[id].replace(/\{(\w+)\}/g, (_blank, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`Template ${id}: no value for {${name}}`);
    return String(value);
  });
}
