import { useEffect, useState } from 'react';
import { BellRing, Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useSyncStatus } from '../sync/CloudSync';
import { alertsEnabled, alertsSupport, disableAlerts, enableAlerts } from '../sync/push';
import { GOOGLE_CLIENT_ID, loadGoogleScript } from '../auth/google';
import IOSSwitch from './IOSSwitch';

// Settings card: cloud backup status, and goal-time alerts on this device.
export default function CloudSettings() {
  const { cloud, signIn } = useAuth();
  const { status, lastSynced, syncNow } = useSyncStatus();
  const [alertsOn, setAlertsOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    alertsEnabled().then(setAlertsOn).catch(() => setAlertsOn(false));
    // Google's script must be loaded before a tap, so its popup isn't blocked.
    if (GOOGLE_CLIENT_ID) loadGoogleScript().catch(() => undefined);
  }, []);

  async function connect() {
    setBusy(true);
    setMessage(null);
    try {
      await signIn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleAlerts(next: boolean) {
    setMessage(null);
    if (!next) {
      await disableAlerts();
      setAlertsOn(false);
      return;
    }
    const result = await enableAlerts();
    if (result.ok) setAlertsOn(true);
    else setMessage(result.message);
  }

  const time = lastSynced ? lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <section className="card space-y-4" aria-labelledby="cloud-heading">
      <h2 id="cloud-heading" className="flex items-center gap-2 font-semibold">
        {cloud === 'connected' ? <Cloud className="h-5 w-5 text-neon-cyan" aria-hidden /> : <CloudOff className="h-5 w-5 text-white/50" aria-hidden />}
        Cloud backup
      </h2>

      {cloud === 'connected' && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <p className="muted" role="status">
            {status === 'syncing' ? 'Syncing…' : status === 'offline' ? "Offline: changes will upload when you're back online." : time ? `Backed up and synced at ${time}.` : 'Backed up.'}
          </p>
          <button type="button" className="icon-btn shrink-0" aria-label="Sync now" onClick={syncNow} disabled={status === 'syncing'}>
            <RefreshCw className={`h-5 w-5 ${status === 'syncing' ? 'animate-spin' : ''}`} aria-hidden />
          </button>
        </div>
      )}
      {cloud === 'needsSignIn' && (
        <div className="space-y-2">
          <p className="muted text-sm">Back up your goals and use them on any phone. Sign in with Google once more to turn it on.</p>
          <button type="button" className="btn-primary w-full" onClick={connect} disabled={busy}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Cloud className="h-5 w-5" aria-hidden />} Turn on cloud backup
          </button>
        </div>
      )}
      {cloud === 'notConfigured' && <p className="muted text-sm">Cloud backup isn't set up on the server yet. Your data is saved on this device.</p>}
      {cloud === 'offline' && <p className="muted text-sm">Can't reach the server right now. Your data is safe on this device.</p>}
      {cloud === 'demo' && <p className="muted text-sm">Dev mode: data isn't backed up.</p>}
      {cloud === 'checking' && <p className="muted text-sm">Checking…</p>}

      <div className="flex items-center justify-between gap-3 border-t border-violet-100 pt-3 dark:border-white/10">
        <div>
          <p className="flex items-center gap-2 font-medium">
            <BellRing className="h-4 w-4 text-neon-pink" aria-hidden /> Goal-time alerts
          </p>
          <p className="muted text-xs">
            {alertsSupport() === 'needsHomeScreen'
              ? 'On iPhone: add the app to your Home Screen first.'
              : 'A notification at each goal’s time, even when the app is closed.'}
          </p>
        </div>
        <IOSSwitch checked={alertsOn} onChange={toggleAlerts} label="Goal-time alerts" />
      </div>

      {message && (
        <p role="alert" className="text-sm font-medium text-red-500 dark:text-red-400">
          {message}
        </p>
      )}
    </section>
  );
}
