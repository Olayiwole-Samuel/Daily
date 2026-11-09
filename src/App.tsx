import { useCallback, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useAuth } from './auth/AuthContext';
import { AppProvider } from './state/AppContext';
import { storageKeyFor } from './state/storage';
import TabBar from './components/TabBar';
import TopBar from './components/TopBar';
import Toast from './components/Toast';
import NeonBackground from './components/NeonBackground';
import ClickSparks from './components/ClickSparks';
import SplashScreen from './components/SplashScreen';
import { useTheme } from './hooks/useTheme';
import { useStreakCelebrations } from './hooks/useStreakCelebrations';
import LoginPage from './pages/LoginPage';
import TodayPage from './pages/TodayPage';
import WeekPage from './pages/WeekPage';
import GoalsPage from './pages/GoalsPage';
import FoodPage from './pages/FoodPage';
import SettingsPage from './pages/SettingsPage';
import CoachPage from './pages/coach/CoachPage';
import CoachStartPage from './pages/coach/CoachStartPage';
import MealsPage from './pages/coach/MealsPage';
import ProgressPage from './pages/coach/ProgressPage';
import SessionPage from './pages/coach/SessionPage';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Today',
  '/week': 'Week',
  '/goals': 'Goals',
  '/food': 'Food',
  '/settings': 'Settings',
  '/coach': 'My plan',
  '/coach/start': 'Coach setup',
  '/coach/meals': 'Meals',
  '/coach/progress': 'Progress',
};

// The signed-in app: nav, animated page switching, celebrations.
function Shell() {
  useTheme();
  const location = useLocation();
  // Lives at the top so a streak milestone celebrates no matter which page you're on.
  const { message, clear } = useStreakCelebrations();

  return (
    <div className="min-h-screen md:flex">
      <TabBar />
      <TopBar title={PAGE_TITLES[location.pathname] ?? 'Today'} />
      {/* Padding clears the notch/status bar on top and the floating tab bar + home indicator below. */}
      <main
        id="app-main"
        className="mx-auto w-full max-w-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+8rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)] md:pb-10 md:pt-10"
      >
        {/* mode="wait": the old page finishes leaving before the new one arrives. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 24, scale: 0.98, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -16, scale: 0.98, filter: 'blur(6px)' }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <Routes location={location}>
              <Route path="/" element={<TodayPage />} />
              <Route path="/week" element={<WeekPage />} />
              <Route path="/goals" element={<GoalsPage />} />
              <Route path="/food" element={<FoodPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/coach" element={<CoachPage />} />
              <Route path="/coach/start" element={<CoachStartPage />} />
              <Route path="/coach/meals" element={<MealsPage />} />
              <Route path="/coach/progress" element={<ProgressPage />} />
              <Route path="/coach/session/:routineId" element={<SessionPage />} />
              <Route path="*" element={<TodayPage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      <Toast message={message} onClose={clear} />
    </div>
  );
}

export default function App() {
  const { user } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const hideSplash = useCallback(() => setShowSplash(false), []);

  return (
    // reducedMotion="user": framer-motion tones animations down if the OS asks for it.
    <MotionConfig reducedMotion="user">
      <NeonBackground />
      <ClickSparks />
      {user ? (
        <AppProvider key={user.id} storageKey={storageKeyFor(user.id)}>
          <Shell />
        </AppProvider>
      ) : (
        <LoginPage />
      )}
      <AnimatePresence>{showSplash && <SplashScreen key="splash" onDone={hideSplash} />}</AnimatePresence>
    </MotionConfig>
  );
}
