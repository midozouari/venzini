// UI-01 Login (UC-01, FR-01): deep navy canvas with the logo on a floating off-white card.
import { zodResolver } from '@hookform/resolvers/zod';
import { formatMessage, ROLE_HOME } from '@venzini/contracts';
import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { useLogin, useMe } from '@/api/hooks';
import { canOpen } from '@/app/routes';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';

// Same limits as the LoginRequest contract (API-01), with the SRS 14.2 wording.
const LoginForm = z.object({
  login: z
    .string()
    .trim()
    .min(1, formatMessage('ERR-VAL-01', { field: 'Login' }))
    .min(3, 'Login: must be at least 3 characters.')
    .max(40, 'Login: must be 40 characters or fewer.'),
  password: z
    .string()
    .min(1, formatMessage('ERR-VAL-01', { field: 'Password' }))
    .max(200, 'Password: must be 200 characters or fewer.'),
});
type LoginForm = z.infer<typeof LoginForm>;

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const me = useMe();
  const login = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginForm>({
    resolver: zodResolver(LoginForm),
    defaultValues: { login: '', password: '' },
  });

  // UI-01: focus on the first field.
  useEffect(() => form.setFocus('login'), [form]);

  const next = params.get('next');
  const expired = params.get('expired') === '1';

  // Already signed in (not just now): go home.
  if (me.data && login.isIdle) return <Navigate to={ROLE_HOME[me.data.user.role]} replace />;

  const onSubmit = form.handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: (res) => {
        const target = next && canOpen(next.split('?')[0] ?? '', res.user.role) ? next : res.home;
        navigate(target, { replace: true });
      },
    }),
  );

  const serverError =
    login.error instanceof ApiError
      ? login.error.message
      : login.error
        ? formatMessage('ERR-SYS-01')
        : null;
  const notice = serverError ?? (expired ? formatMessage('ERR-AUTH-05') : null);

  return (
    <main className="relative flex min-h-full items-center justify-center overflow-hidden bg-navy-900 px-6 py-16">
      {/* Slow, very subtle glow on the navy canvas. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_520px_at_50%_-8%,rgb(59_111_216/0.22),transparent_65%),radial-gradient(700px_500px_at_100%_110%,rgb(247_243_236/0.07),transparent_60%)]"
      />
      <div className="relative w-[460px] animate-in fade-in-0 slide-in-from-bottom-3 duration-500 ease-out">
        <div className="rounded-dialog border border-line bg-panel px-10 pb-10 pt-12 shadow-dialog">
          <img src="/logo.png" alt="Venzini" className="mx-auto h-auto w-full max-w-[340px]" />
          <p className="mt-6 text-center text-body text-muted">
            Fuel demand forecasting and delivery planning
          </p>

          <form noValidate onSubmit={onSubmit} className="mt-10 flex flex-col gap-5">
            <TextField
              label="Login"
              autoComplete="username"
              error={form.formState.errors.login?.message}
              {...form.register('login')}
            />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              error={form.formState.errors.password?.message}
              trailing={
                <Button
                  variant="quiet"
                  size="icon"
                  className="size-10"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              }
              {...form.register('password')}
            />

            <div aria-live="assertive" role="alert" className="min-h-0">
              {notice ? (
                <p className="rounded-control bg-navy-tint px-4 py-3 text-body text-ink animate-in fade-in-0 duration-200">
                  {notice}
                </p>
              ) : null}
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
              {login.isPending ? 'Signing in…' : 'Log in'}
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-caption text-panel/70">
          MVP prototype · fake sample data only
        </p>
      </div>
    </main>
  );
}
