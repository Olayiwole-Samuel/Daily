import { useEffect } from 'react';
import { useApp } from '../state/AppContext';

// Adds or removes the `dark` class on <html>, which Tailwind's dark: styles look for.
export function useTheme(): void {
  const { state } = useApp();
  const theme = state.settings.theme;

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    // In 'system' mode, follow the phone/OS when it switches.
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
