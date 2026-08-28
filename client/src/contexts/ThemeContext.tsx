import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";
export type BrandTheme = "verde" | "xsti";
export type TypographyFontFamily = "arial" | "tahoma" | "verdana" | "calibri";
export type TypographyWeight = "normal" | "bold";
export type TypographyStyle = "normal" | "italic";

export interface TypographySettings {
  fontFamily: TypographyFontFamily;
  fontSize: number;
  fontWeight: TypographyWeight;
  fontStyle: TypographyStyle;
}

export type TypographySettingsByTheme = Record<BrandTheme, TypographySettings>;

export const TYPOGRAPHY_STORAGE_KEY = "production-theme-typography-v2";

export const DEFAULT_TYPOGRAPHY_SETTINGS: TypographySettingsByTheme = {
  verde: { fontFamily: "tahoma", fontSize: 15, fontWeight: "bold", fontStyle: "normal" },
  xsti: { fontFamily: "tahoma", fontSize: 15, fontWeight: "bold", fontStyle: "normal" },
};

export const FONT_FAMILY_CSS: Record<TypographyFontFamily, string> = {
  arial: "Arial, Helvetica, sans-serif",
  tahoma: "Tahoma, Arial, sans-serif",
  verdana: "Verdana, Arial, sans-serif",
  calibri: "Calibri, Arial, sans-serif",
};

function isBrandTheme(value: unknown): value is BrandTheme {
  return value === "verde" || value === "xsti";
}

function isFontFamily(value: unknown): value is TypographyFontFamily {
  return value === "arial" || value === "tahoma" || value === "verdana" || value === "calibri";
}

function isWeight(value: unknown): value is TypographyWeight {
  return value === "normal" || value === "bold";
}

function isStyle(value: unknown): value is TypographyStyle {
  return value === "normal" || value === "italic";
}

function normalizeThemeTypography(value: unknown, fallback: TypographySettings): TypographySettings {
  if (!value || typeof value !== "object") return fallback;

  const candidate = value as Partial<TypographySettings>;
  const fontSize = Number(candidate.fontSize);

  return {
    fontFamily: isFontFamily(candidate.fontFamily) ? candidate.fontFamily : fallback.fontFamily,
    fontSize: Number.isFinite(fontSize) && fontSize >= 13 && fontSize <= 22 ? Math.round(fontSize) : fallback.fontSize,
    fontWeight: isWeight(candidate.fontWeight) ? candidate.fontWeight : fallback.fontWeight,
    fontStyle: isStyle(candidate.fontStyle) ? candidate.fontStyle : fallback.fontStyle,
  };
}

export function normalizeTypographySettings(value: unknown): TypographySettingsByTheme {
  const candidate = value && typeof value === "object" ? value as Partial<Record<BrandTheme, unknown>> : {};

  return {
    verde: normalizeThemeTypography(candidate.verde, DEFAULT_TYPOGRAPHY_SETTINGS.verde),
    xsti: normalizeThemeTypography(candidate.xsti, DEFAULT_TYPOGRAPHY_SETTINGS.xsti),
  };
}

function loadTypographySettings(): TypographySettingsByTheme {
  if (typeof window === "undefined") return DEFAULT_TYPOGRAPHY_SETTINGS;

  try {
    const stored = window.localStorage.getItem(TYPOGRAPHY_STORAGE_KEY);
    return stored ? normalizeTypographySettings(JSON.parse(stored)) : DEFAULT_TYPOGRAPHY_SETTINGS;
  } catch {
    return DEFAULT_TYPOGRAPHY_SETTINGS;
  }
}

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
  brandTheme: BrandTheme;
  setBrandTheme: (theme: BrandTheme) => void;
  typography: TypographySettings;
  setTypography: (settings: Partial<TypographySettings>) => void;
  resetTypography: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      const stored = localStorage.getItem("theme");
      return (stored as Theme) || defaultTheme;
    }
    return defaultTheme;
  });
  const [brandTheme, setBrandTheme] = useState<BrandTheme>(() => {
    const stored = localStorage.getItem("production-brand-theme");
    return isBrandTheme(stored) ? stored : "verde";
  });
  const [typographyByTheme, setTypographyByTheme] = useState<TypographySettingsByTheme>(loadTypographySettings);

  const typography = typographyByTheme[brandTheme];

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    if (switchable) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, switchable]);

  useEffect(() => {
    document.documentElement.dataset.brandTheme = brandTheme;
    localStorage.setItem("production-brand-theme", brandTheme);
  }, [brandTheme]);

  useEffect(() => {
    localStorage.setItem(TYPOGRAPHY_STORAGE_KEY, JSON.stringify(typographyByTheme));
  }, [typographyByTheme]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--app-font-family", FONT_FAMILY_CSS[typography.fontFamily]);
    root.style.setProperty("--app-font-size", `${typography.fontSize}px`);
    root.style.setProperty("--app-font-weight", typography.fontWeight === "bold" ? "700" : "400");
    root.style.setProperty("--app-font-style", typography.fontStyle);
    root.dataset.typographyWeight = typography.fontWeight;
    root.dataset.typographyStyle = typography.fontStyle;
  }, [typography]);

  const setTypography = (settings: Partial<TypographySettings>) => {
    setTypographyByTheme(previous => ({
      ...previous,
      [brandTheme]: normalizeThemeTypography({ ...previous[brandTheme], ...settings }, previous[brandTheme]),
    }));
  };

  const resetTypography = () => {
    setTypographyByTheme(previous => ({
      ...previous,
      [brandTheme]: DEFAULT_TYPOGRAPHY_SETTINGS[brandTheme],
    }));
  };

  const toggleTheme = switchable
    ? () => {
        setTheme(prev => (prev === "light" ? "dark" : "light"));
      }
    : undefined;

  const value = useMemo(() => ({
    theme,
    toggleTheme,
    switchable,
    brandTheme,
    setBrandTheme,
    typography,
    setTypography,
    resetTypography,
  }), [theme, toggleTheme, switchable, brandTheme, typography]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
