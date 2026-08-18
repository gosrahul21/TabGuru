import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { WHITE, resolveTokens, type ThemeMode, type ThemeTokens } from './themes';

const STORAGE_KEY = 'tabguru-theme-mode';

interface ThemeCtx {
  mode: ThemeMode;
  theme: ThemeTokens;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  mode: 'default',
  theme: WHITE,
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem(STORAGE_KEY) as ThemeMode) ?? 'default';
  });

  const [theme, setTheme] = useState<ThemeTokens>(() =>
    resolveTokens((localStorage.getItem(STORAGE_KEY) as ThemeMode) ?? 'default')
  );

  // Sync with chrome.storage if changed elsewhere (e.g. popup)
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        const newMode = changes[STORAGE_KEY].newValue as ThemeMode;
        setModeState(newMode);
        setTheme(resolveTokens(newMode));
        localStorage.setItem(STORAGE_KEY, newMode);
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    setTheme(resolveTokens(m));
    localStorage.setItem(STORAGE_KEY, m);
    chrome.storage.local.set({ [STORAGE_KEY]: m });
  };

  return (
    <ThemeContext.Provider value={{ mode, theme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
