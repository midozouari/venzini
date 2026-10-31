// Error codes and user-facing messages: SRS 14.2, plus ERR-API-03 and ERR-AUTH-06 from SDD 5.6.7.
// Blanks in braces are filled by formatMessage; numbers are passed already formatted ("34,000").

export const ERRORS = {
  'ERR-AUTH-01': { status: 401, message: 'Login or password is incorrect.' },
  'ERR-AUTH-02': {
    status: 401,
    message: 'This account is deactivated. Contact your system admin.',
  },
  'ERR-AUTH-03': { status: 401, message: 'Too many attempts. Try again in {n} minutes.' },
  'ERR-AUTH-04': { status: 403, message: "You don't have access to this page." },
  'ERR-AUTH-05': { status: 401, message: 'Your session has expired. Please log in again.' },
  'ERR-AUTH-06': {
    status: 403,
    message: 'Request blocked for security reasons. Reload the page and try again.',
  },
  'ERR-VAL-01': { status: 400, message: '{field} is required.' },
  'ERR-VAL-02': { status: 400, message: '{field}: {rule}' },
  'ERR-VAL-03': { status: 400, message: 'This {item} already exists.' },
  'ERR-VAL-04': {
    status: 409,
    message: 'The plan for {day} is already decided. This data can no longer be changed.',
  },
  'ERR-VAL-05a': {
    status: 400,
    message: 'This quantity exceeds the space left on tanker {tanker}. Enter {max} L or less.',
  },
  'ERR-VAL-05b': {
    status: 400,
    message: "This quantity exceeds the free space in the station's tank. Enter {max} L or less.",
  },
  'ERR-VAL-05c': {
    status: 400,
    message: 'This quantity exceeds the {fuel} stock at {warehouse}. Enter {max} L or less.',
  },
  'ERR-VAL-07': { status: 400, message: "You can't deactivate your own admin account." },
  'ERR-PLAN-01': { status: 422, message: 'No plan can be made: {missing} for {day}.' },
  'ERR-PLAN-02': { status: 422, message: 'Resources for {day} are not uploaded yet.' },
  'ERR-PLAN-03': { status: 422, message: 'No feasible plan with these quantities: {constraint}.' },
  'ERR-PLAN-04': {
    status: 409,
    message:
      'Tanker {tanker} is overloaded: {load} L on a {capacity} L tanker. Remove {excess} L before approving.',
  },
  'ERR-DATA-01': { status: null, message: 'Data unavailable for {station}.' },
  'ERR-DATA-02': {
    status: null,
    message: 'No distance data for {station}; it is left out of the plan.',
  },
  'ERR-DATA-03': { status: null, message: 'Route cost not available: missing {missing}.' },
  'ERR-AI-01': { status: null, message: 'Manual planning needed for {station} {fuel}: {reason}.' },
  'ERR-AI-02': { status: null, message: 'Low confidence: {input} is missing for this forecast.' },
  'ERR-AI-03': { status: null, message: 'Explanation shortened: some details are not available.' },
  'ERR-API-01': { status: 404, message: "We couldn't find this item. It may have been removed." },
  'ERR-API-02': { status: 429, message: 'Too many requests. Please wait a moment.' },
  'ERR-API-03': {
    status: 409,
    message: 'This plan changed since you opened it. Reload to see the latest version.',
  },
  'ERR-SYS-01': {
    status: 500,
    message: "The change couldn't be calculated and was undone. Please try again.",
  },
  'ERR-SYS-02': {
    status: 500,
    message:
      'The plan failed a safety check and was not shown. Please try again or contact support.',
  },
  'ERR-SYS-03': { status: null, message: 'Map background unavailable; routes are still shown.' },
  'ERR-SYS-04': {
    status: 500,
    message: "Your decision couldn't be saved. Nothing was changed. Please try again.",
  },
  'WARN-RES-01': {
    status: null,
    message:
      'Tanker {tanker} has not returned from trip {trip}. Check before marking it available.',
  },
  'WARN-EDIT-01': {
    status: 422,
    message:
      'This tanker loads at another warehouse. Stations can only move between tankers of {warehouse}.',
  },
} as const satisfies Record<string, { status: number | null; message: string }>;

export type ErrorCode = keyof typeof ERRORS;

/** Fills the blanks of an error message. Unknown blanks are left as they are. */
export function formatMessage(
  code: ErrorCode,
  params: Record<string, string | number> = {},
): string {
  return ERRORS[code].message.replace(/\{(\w+)\}/g, (blank, name: string) =>
    name in params ? String(params[name]) : blank,
  );
}
