import { useCallback, useEffect, useState } from 'react';

const THEME_KEY = 'jingga_theme_mode';
const THEMES = {
  light: 'light',
  dark: 'dark',
};

const getInitialTheme = () => {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === THEMES.light || stored === THEMES.dark) return stored;
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? THEMES.dark : THEMES.light;
};

const applyTheme = (theme) => {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
};

const useThemeMode = () => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === THEMES.dark ? THEMES.light : THEMES.dark));
  }, []);

  return { theme, isDark: theme === THEMES.dark, toggleTheme };
};

export default useThemeMode;
