import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { themeParams } from '@tma.js/sdk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentProfile, profileQueryKeys, updateCurrentProfile } from '../features/profile/api';

type ThemeMode = 'telegram' | 'dark' | 'light' | 'matchday-neon';
type ResolvedTheme = 'dark' | 'light' | 'matchday-neon';
type ThemeContextValue = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'hooma-theme';

function telegramTheme(): 'dark' | 'light' {
  try {
    const bg = themeParams.bgColor();
    if (bg) {
      const hex = bg.replace('#', '');
      if (/^[0-9a-f]{6}$/i.test(hex)) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b < 130 ? 'dark' : 'light';
      }
    }
  } catch {
    // Browser fallback when the Mini App is not running inside Telegram.
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function fromServerTheme(value?: string | null): ThemeMode | null {
  if (value === 'TELEGRAM') return 'telegram';
  if (value === 'DARK') return 'dark';
  if (value === 'LIGHT') return 'light';
  if (value === 'MATCHDAY_NEON') return 'matchday-neon';
  return null;
}

function toServerTheme(value: ThemeMode): 'TELEGRAM' | 'DARK' | 'LIGHT' | 'MATCHDAY_NEON' {
  if (value === 'telegram') return 'TELEGRAM';
  if (value === 'matchday-neon') return 'MATCHDAY_NEON';
  return value === 'dark' ? 'DARK' : 'LIGHT';
}

function validStoredTheme(value: string | null): ThemeMode | null {
  return value === 'dark' ||
    value === 'light' ||
    value === 'telegram' ||
    value === 'matchday-neon'
    ? value
    : null;
}

function storedTheme(): ThemeMode {
  return validStoredTheme(localStorage.getItem(STORAGE_KEY)) ?? 'matchday-neon';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [initialMode] = useState<ThemeMode>(storedTheme);
  const [manualMode, setManualMode] = useState<ThemeMode | null>(null);
  const [telegramResolved, setTelegramResolved] = useState<'dark' | 'light'>(() => telegramTheme());

  const meQuery = useQuery({
    queryKey: profileQueryKeys.me(),
    queryFn: getCurrentProfile,
    staleTime: 60_000,
  });

  const serverMode = fromServerTheme(meQuery.data?.preference?.themeOverride);
  const mode = manualMode ?? serverMode ?? initialMode;
  const resolved: ResolvedTheme = mode === 'telegram' ? telegramResolved : mode;

  const persistTheme = useMutation({
    mutationFn: (next: ThemeMode) => updateCurrentProfile({ themeOverride: toServerTheme(next) }),
    onSuccess: (updated) => queryClient.setQueryData(profileQueryKeys.me(), updated),
  });

  useEffect(() => {
    if (!serverMode || manualMode) return;
    localStorage.setItem(STORAGE_KEY, serverMode);
  }, [manualMode, serverMode]);

  useEffect(() => {
    const timer = window.setInterval(() => setTelegramResolved(telegramTheme()), 700);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.backgroundColor =
      resolved === 'matchday-neon' ? '#03050B' : resolved === 'dark' ? '#050505' : '#ffffff';
  }, [resolved]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      localStorage.setItem(STORAGE_KEY, next);
      setManualMode(next);
      if (meQuery.data) persistTheme.mutate(next);
    },
    [meQuery.data, persistTheme],
  );

  const toggle = useCallback(() => {
    setMode(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setMode]);

  const value = useMemo(
    () => ({ mode, resolved, setMode, toggle }),
    [mode, resolved, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within ThemeProvider');
  return value;
}
