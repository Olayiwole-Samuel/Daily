import { useEffect, useState } from 'react';
import { todayISO } from '../lib/dates';

// Today's date that updates itself after midnight (and when the app comes back
// to the foreground), so an app left open overnight doesn't show yesterday.
export function useToday(): string {
  const [today, setToday] = useState(todayISO);

  useEffect(() => {
    const check = () => setToday(todayISO());
    const timer = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  return today;
}
