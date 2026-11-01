// API-01 to API-04: login, logout, current user, users (SDD 5.6.3).
import { z } from 'zod';
import { IsoDateTime, paginated, RecordStatus, Role } from './common';

export const LoginRequest = z.strictObject({
  login: z.string().min(3).max(40),
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const SessionUser = z.object({ id: z.string(), full_name: z.string(), role: Role });
export type SessionUser = z.infer<typeof SessionUser>;

export const LoginResponse = z.object({
  user: SessionUser,
  home: z.string(),
  idle_timeout_min: z.number().int(),
});
export type LoginResponse = z.infer<typeof LoginResponse>;

export const Page = z.enum([
  'network',
  'forecast',
  'resources',
  'trips',
  'warehouse-forecast',
  'planner',
  'approvals',
  'history',
  'users',
  'stations',
]);
export type Page = z.infer<typeof Page>;

export const Capabilities = z.object({
  edit_plan: z.boolean(),
  decide: z.boolean(),
  save_resources: z.boolean(),
  record_trips: z.boolean(),
  manage_users: z.boolean(),
  manage_stations: z.boolean(),
});

export const MeResponse = z.object({ user: SessionUser, pages: z.array(Page), can: Capabilities });
export type MeResponse = z.infer<typeof MeResponse>;

// API-04 · Users
export const User = z.object({
  id: z.string(),
  full_name: z.string(),
  login: z.string(),
  role: Role,
  status: RecordStatus,
  created_at: IsoDateTime,
});
export type User = z.infer<typeof User>;

export const UserList = paginated(User);
export type UserList = z.infer<typeof UserList>;

const FullName = z.string().trim().min(1).max(80);
const Login = z
  .string()
  .trim()
  .min(3, 'must be 3 to 40 characters')
  .max(40, 'must be 3 to 40 characters');
const Password = z.string().min(10, 'must be at least 10 characters').max(200);

export const CreateUserRequest = z.strictObject({
  full_name: FullName,
  login: Login,
  password: Password,
  role: Role,
});
export type CreateUserRequest = z.infer<typeof CreateUserRequest>;

export const UpdateUserRequest = z
  .strictObject({
    full_name: FullName.optional(),
    role: Role.optional(),
    status: RecordStatus.optional(),
    password: Password.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'at least one field must change' });
export type UpdateUserRequest = z.infer<typeof UpdateUserRequest>;
