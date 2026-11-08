import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import type { AppState } from '../types';
import { reducer, type Action } from './reducer';
import { loadState, saveState } from './storage';

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

// A reducer whose state is loaded from and saved to localStorage under `storageKey`.
function usePersistedReducer(storageKey: string) {
  // The third argument is a lazy initializer, so loadState only runs once.
  const [state, dispatch] = useReducer(reducer, storageKey, loadState);

  // Save after every change. The state is small, so writing it all is fine.
  useEffect(() => {
    saveState(storageKey, state);
  }, [storageKey, state]);

  return [state, dispatch] as const;
}

// Render with key={userId} so switching accounts starts a fresh provider.
export function AppProvider({ storageKey, children }: { storageKey: string; children: ReactNode }) {
  const [state, dispatch] = usePersistedReducer(storageKey);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

// Any component calls useApp() to read state and dispatch actions.
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
