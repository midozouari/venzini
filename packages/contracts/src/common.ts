import { z } from 'zod';

/** A delivery day or sales date: a local date in Africa/Tunis, YYYY-MM-DD (SDD 5.3.2, 6.5). */
export const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date (YYYY-MM-DD)');
/** An instant: ISO 8601 in UTC (SDD 5.6.1). */
export const IsoDateTime = z.iso.datetime();
/** A local wall-clock time, 24 h "HH:MM" (delivery windows). */
export const LocalTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a time (HH:MM)');

export const Role = z.enum(['manager', 'dispatcher', 'admin']);
export type Role = z.infer<typeof Role>;

export const RecordStatus = z.enum(['active', 'inactive']);
export const RiskLevel = z.enum(['high', 'medium', 'low']);
export type RiskLevel = z.infer<typeof RiskLevel>;
export const Severity = z.enum(['low', 'medium', 'high']);
export type Severity = z.infer<typeof Severity>;

/** Litres are whole numbers (D-20, NFR-31). */
export const Litres = z.number().int().min(0);
/** Money in USD with 2 decimals in API responses (D-20). */
export const Usd = z.number();

export const Id = z.string().min(1).max(40);

export const UserRef = z.object({ id: z.string(), full_name: z.string() });
export type UserRef = z.infer<typeof UserRef>;

export const DriverRef = z.object({ driver_id: z.string(), full_name: z.string() });

/** Error body of every failed request (SDD 5.6.1). */
export const ErrorBody = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    field: z.string().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ErrorBody = z.infer<typeof ErrorBody>;

/** Paging query of every list endpoint (SDD 5.6.1). */
export const PageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
});

/** Paged list response {items, page, page_size, total} (SDD 5.6.1). */
export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    page_size: z.number().int().min(1).max(200),
    total: z.number().int().min(0),
  });

/** Header every POST, PUT, PATCH and DELETE must carry (SDD 5.6.1, CSRF). */
export const CSRF_HEADER = 'X-Requested-With';
export const CSRF_VALUE = 'venzini';
/** Response header carrying the correlation ID (SDD 5.6.1). */
export const CORRELATION_HEADER = 'X-Correlation-Id';
