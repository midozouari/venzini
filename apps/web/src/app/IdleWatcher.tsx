// Session idle limit (NFR-22): a warning 2 minutes before 30 idle minutes, with "Stay signed in"
// (SRS 14.3, SDD 6.1.2). At the limit the user is logged out and sees ERR-AUTH-05.
import { SESSION_IDLE_MIN, SESSION_WARNING_MIN } from '@venzini/contracts';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { SESSION_EXPIRED_EVENT } from '@/api/client';
import { useLogout } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

const IDLE_MS = SESSION_IDLE_MIN * 60_000;
const WARN_MS = (SESSION_IDLE_MIN - SESSION_WARNING_MIN) * 60_000;
const ACTIVITY = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

export function IdleWatcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mutate: logout } = useLogout();
  const [warning, setWarning] = useState(false);
  const last = useRef(0);
  const warningRef = useRef(false);

  useEffect(() => {
    if (last.current === 0) last.current = Date.now();
    const expire = () => {
      setWarning(false);
      logout(undefined, {
        onSettled: () =>
          navigate(
            `/login?expired=1&next=${encodeURIComponent(location.pathname + location.search)}`,
            {
              replace: true,
            },
          ),
      });
    };
    const onActivity = () => {
      if (!warningRef.current) last.current = Date.now();
    };
    const tick = setInterval(() => {
      const idle = Date.now() - last.current;
      if (idle >= IDLE_MS) expire();
      else if (idle >= WARN_MS && !warningRef.current) {
        warningRef.current = true;
        setWarning(true);
      }
    }, 5_000);
    const onExpired = () => expire();
    ACTIVITY.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => {
      clearInterval(tick);
      ACTIVITY.forEach((e) => window.removeEventListener(e, onActivity));
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
    };
  }, [logout, navigate, location.pathname, location.search]);

  const stay = () => {
    warningRef.current = false;
    last.current = Date.now();
    setWarning(false);
  };

  return (
    <Dialog open={warning} onOpenChange={(open) => !open && stay()}>
      <DialogContent>
        <DialogTitle>Are you still there?</DialogTitle>
        <DialogDescription>
          For your security, you will be signed out in {SESSION_WARNING_MIN} minutes if there is no
          activity.
        </DialogDescription>
        <DialogActions>
          <Button onClick={stay}>Stay signed in</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
