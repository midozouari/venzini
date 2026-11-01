// UI-08 Administration, Users tab (UC-09; FR-05, BR-13, BR-15). The admin creates, edits,
// deactivates and reactivates accounts and sets their role (three roles only, no drivers).
// Accounts are never deleted. Deactivating or changing a role ends that user's session.
import type { Role, UpdateUserRequest, User } from '@venzini/contracts';
import { Pencil, UserPlus, UserRoundCheck, UserRoundX, Users } from 'lucide-react';
import { useState } from 'react';
import { useCreateUser, useMe, useUpdateUser, useUsers } from '@/api/hooks';
import { ContentArea } from '@/app/Shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { SelectField, TextField } from '@/components/ui/field';
import { Panel } from '@/components/ui/panel';
import { EmptyState, Skeleton } from '@/components/ui/states';
import {
  AdminTabs,
  ConfirmDialog,
  formErrors,
  FormError,
  RecordStatusChip,
  ResultNote,
  type Result,
} from '@/features/admin/parts';
import { formatDay, ROLE_LABEL } from '@/lib/format';
import { isoToTunis } from '@/lib/time';
import { cn } from '@/lib/utils';

const ROLES: Role[] = ['manager', 'dispatcher', 'admin'];

type Action =
  { kind: 'create' } | { kind: 'edit'; user: User } | { kind: 'deactivate'; user: User };

export function UsersPage() {
  const users = useUsers();
  const { data: me } = useMe();
  const update = useUpdateUser();
  const [action, setAction] = useState<Action | null>(null);
  const [result, setResult] = useState<Result>(null);
  const items = users.data?.items ?? [];

  const reactivate = (user: User) => {
    setResult(null);
    update.mutate(
      { id: user.id, body: { status: 'active' } },
      {
        onSuccess: () =>
          setResult({ tone: 'status', text: `${user.full_name} is active again and can log in.` }),
        onError: (e) => setResult({ tone: 'alert', text: e.message }),
      },
    );
  };

  return (
    <ContentArea>
      <div className="flex min-h-full flex-col gap-[var(--vz-gap)]">
        <div>
          <AdminTabs />
        </div>

        <ResultNote result={result} />

        {users.isPending ? (
          <Skeleton className="h-[320px] rounded-panel" />
        ) : users.isError ? (
          <Panel className="mx-auto mt-6 w-[520px]">
            <EmptyState
              icon={Users}
              title="The users could not be loaded"
              action={<Button onClick={() => users.refetch()}>Try again</Button>}
            >
              {users.error.message}
            </EmptyState>
          </Panel>
        ) : (
          <Panel className="p-2 animate-in fade-in-0 duration-200" role="region" aria-label="Users">
            <div className="flex items-center justify-between gap-4 px-4 pb-2 pt-3">
              <p className="text-body text-muted">
                Accounts are never deleted, only deactivated, so past decisions keep their author.
              </p>
              <Button
                onClick={() => {
                  setResult(null);
                  setAction({ kind: 'create' });
                }}
              >
                <UserPlus aria-hidden /> New user
              </Button>
            </div>
            <table className="w-full table-fixed border-separate border-spacing-0 text-left">
              <colgroup>
                <col className="w-[230px]" />
                <col className="w-[150px]" />
                <col className="w-[190px]" />
                <col className="w-[110px]" />
                <col className="w-[130px]" />
                <col />
              </colgroup>
              <thead>
                <tr>
                  {['Name', 'Login', 'Role', 'Status', 'Created', ''].map((c, i) => (
                    <th
                      key={c || i}
                      scope="col"
                      className="border-b border-line px-3 pb-3 pt-2 text-caption font-medium text-muted first:pl-4"
                    >
                      {c || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    isMe={u.id === me?.user.id}
                    busy={update.isPending && update.variables?.id === u.id}
                    onEdit={() => {
                      setResult(null);
                      setAction({ kind: 'edit', user: u });
                    }}
                    onDeactivate={() => {
                      setResult(null);
                      setAction({ kind: 'deactivate', user: u });
                    }}
                    onReactivate={() => reactivate(u)}
                  />
                ))}
              </tbody>
            </table>
          </Panel>
        )}
      </div>

      {action?.kind === 'deactivate' ? (
        <DeactivateDialog
          user={action.user}
          onClose={() => setAction(null)}
          onDone={(text) => {
            setAction(null);
            setResult({ tone: 'status', text });
          }}
        />
      ) : action ? (
        <UserDialog
          user={action.kind === 'edit' ? action.user : null}
          onClose={() => setAction(null)}
          onDone={(text) => {
            setAction(null);
            setResult({ tone: 'status', text });
          }}
        />
      ) : null}
    </ContentArea>
  );
}

function UserRow({
  user: u,
  isMe,
  busy,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  user: User;
  isMe: boolean;
  busy: boolean;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  const cell = 'px-3 py-3 align-middle text-body text-ink';
  return (
    <tr className="transition-[background-color] duration-150 ease-vz hover:bg-navy-tint [&>td:first-child]:rounded-l-control [&>td:last-child]:rounded-r-control">
      <td className={cn(cell, 'pl-4 font-medium')}>
        <span className="truncate">{u.full_name}</span>
        {isMe ? <span className="ml-2 text-caption font-normal text-muted">(you)</span> : null}
      </td>
      <td className={cn(cell, 'truncate')}>{u.login}</td>
      <td className={cell}>{ROLE_LABEL[u.role]}</td>
      <td className={cell}>
        <RecordStatusChip status={u.status} />
      </td>
      <td className={cn(cell, 'tabular-nums text-muted')}>
        {formatDay(isoToTunis(u.created_at).day)}
      </td>
      <td className={cn(cell, 'pr-4')}>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onEdit} aria-label={`Edit ${u.full_name}`}>
            <Pencil aria-hidden /> Edit
          </Button>
          {u.status === 'active' ? (
            <Button
              variant="quiet"
              size="sm"
              onClick={onDeactivate}
              aria-label={`Deactivate ${u.full_name}`}
            >
              <UserRoundX aria-hidden /> Deactivate
            </Button>
          ) : (
            <Button
              variant="quiet"
              size="sm"
              disabled={busy}
              onClick={onReactivate}
              aria-label={`Reactivate ${u.full_name}`}
            >
              <UserRoundCheck aria-hidden /> Reactivate
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function UserDialog({
  user,
  onClose,
  onDone,
}: {
  user: User | null;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const create = useCreateUser();
  const update = useUpdateUser();
  const mutation = user ? update : create;
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [login, setLogin] = useState(user?.login ?? '');
  const [role, setRole] = useState<Role>(user?.role ?? 'dispatcher');
  const [password, setPassword] = useState('');
  const { fields, form } = formErrors(mutation.error);
  const roleChanged = !!user && role !== user.role;

  const submit = () => {
    if (!user) {
      create.mutate(
        { full_name: fullName, login, password, role },
        { onSuccess: (u) => onDone(`${u.full_name} can now log in as ${u.login}.`) },
      );
      return;
    }
    // Only what changed is sent (PATCH accepts any subset, API-04).
    const body: UpdateUserRequest = {
      ...(fullName !== user.full_name ? { full_name: fullName } : {}),
      ...(roleChanged ? { role } : {}),
      ...(password ? { password } : {}),
    };
    if (Object.keys(body).length === 0) return onClose();
    update.mutate(
      { id: user.id, body },
      { onSuccess: (u) => onDone(`Changes to ${u.full_name} saved.`) },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !mutation.isPending && onClose()}>
      <DialogContent className="w-[520px]" aria-describedby={undefined}>
        <DialogTitle>{user ? `Edit ${user.full_name}` : 'New user'}</DialogTitle>
        <form
          noValidate
          className="mt-6 flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <TextField
            label="Full name"
            name="full_name"
            value={fullName}
            maxLength={80}
            autoComplete="off"
            onChange={(e) => setFullName(e.target.value)}
            error={fields['full_name']}
          />
          <TextField
            label="Login"
            name="login"
            value={login}
            maxLength={40}
            autoComplete="off"
            disabled={!!user}
            onChange={(e) => setLogin(e.target.value)}
            error={fields['login']}
          />
          <div>
            <SelectField
              label="Role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              error={fields['role']}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </SelectField>
            {roleChanged ? (
              <p className="mt-1.5 text-caption text-muted">
                Changing the role ends this user's current session.
              </p>
            ) : null}
          </div>
          <div>
            <TextField
              label={user ? 'New password (optional)' : 'Initial password'}
              name="password"
              type="password"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              error={fields['password']}
            />
            {!fields['password'] ? (
              <p className="mt-1.5 text-caption text-muted">At least 10 characters.</p>
            ) : null}
          </div>
          <FormError message={form} />
          <DialogActions>
            <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
              Back
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : user ? 'Save changes' : 'Create user'}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeactivateDialog({
  user,
  onClose,
  onDone,
}: {
  user: User;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const update = useUpdateUser();
  return (
    <ConfirmDialog
      title={`Deactivate ${user.full_name}?`}
      confirm="Deactivate"
      icon={UserRoundX}
      pending={update.isPending}
      error={update.error?.message}
      onClose={onClose}
      onConfirm={() =>
        update.mutate(
          { id: user.id, body: { status: 'inactive' } },
          { onSuccess: () => onDone(`${user.full_name} is deactivated and can no longer log in.`) },
        )
      }
    >
      {user.full_name} can no longer log in, and any open session ends now. The account is kept, so
      past decisions still show who made them. You can reactivate it later.
    </ConfirmDialog>
  );
}
