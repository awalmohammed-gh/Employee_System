import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

const PRIMARY_THEME_KEY = "app_theme";
const LEGACY_THEME_KEYS = ["theme_preference", "eyenit_theme", "theme"];

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // 1. Initial preference: 'light' | 'dark' | 'system'
  const [theme, setThemeState] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored =
          localStorage.getItem(PRIMARY_THEME_KEY) ||
          localStorage.getItem(LEGACY_THEME_KEYS[0]) ||
          localStorage.getItem(LEGACY_THEME_KEYS[1]) ||
          localStorage.getItem(LEGACY_THEME_KEYS[2]);
        if (stored === "dark" || stored === "light" || stored === "system") {
          return stored;
        }
      } catch (e) {
        console.warn("Failed to read theme preference from storage:", e);
      }
    }
    return "system";
  });

  // 2. Dynamic theme application to root element and matchMedia system listener
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const root = document.documentElement;
    const body = document.body;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const isDark =
        theme === "dark" || (theme === "system" && mediaQuery.matches);
      if (isDark) {
        root.classList.add("dark");
        if (body) body.classList.add("dark");
      } else {
        root.classList.remove("dark");
        if (body) body.classList.remove("dark");
      }
    };

    applyTheme();

    try {
      localStorage.setItem(PRIMARY_THEME_KEY, theme);
      LEGACY_THEME_KEYS.forEach((k) => {
        try {
          localStorage.setItem(k, theme);
        } catch {
          // ignore
        }
      });
    } catch (e) {
      console.warn("Failed to save theme to storage:", e);
    }

    const handleChange = () => {
      if (theme === "system") applyTheme();
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [theme]);

  // 3. Multi-tab synchronization
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = (e) => {
      if (
        e.key === PRIMARY_THEME_KEY ||
        LEGACY_THEME_KEYS.includes(e.key)
      ) {
        const newTheme = e.newValue;
        if (newTheme === "dark" || newTheme === "light" || newTheme === "system") {
          setThemeState(newTheme);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const setTheme = useCallback((newTheme) => {
    if (newTheme === "dark" || newTheme === "light" || newTheme === "system") {
      setThemeState(newTheme);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      if (prev === "light") return "dark";
      if (prev === "dark") return "system";
      return "light";
    });
  }, []);

  const isDark = useMemo(() => {
    if (typeof window === "undefined") return theme === "dark";
    if (theme === "dark") return true;
    if (theme === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }, [theme]);

  const resolvedTheme = isDark ? "dark" : "light";

  const contextValue = useMemo(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
      isDark,
      systemTheme: typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
      toggleTheme,
    }),
    [theme, setTheme, resolvedTheme, isDark, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const ThemeContextProvider = ThemeProvider;

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    const isDark =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark");
    return {
      theme: "system",
      resolvedTheme: isDark ? "dark" : "light",
      isDark,
      systemTheme: isDark ? "dark" : "light",
      toggleTheme: () => {
        if (typeof document !== "undefined") {
          document.documentElement.classList.toggle("dark");
        }
      },
      setTheme: () => {},
    };
  }
  return context;
};

export default ThemeProvider;

