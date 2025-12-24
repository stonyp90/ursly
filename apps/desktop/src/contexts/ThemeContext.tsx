/**
 * Theme Context for Ursly Desktop App
 * Matches the web app theming system for consistency
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';

// ============================================================================
// Theme Color Palettes - Cyberpunk inspired
// ============================================================================

export const themeColors = {
  // Cyan - Primary brand color scheme
  cyan: {
    primary: '#00D4FF',
    secondary: '#7B2CBF',
    accent: '#FF6B35',
    primaryRgb: '0, 212, 255',
    secondaryRgb: '123, 44, 191',
  },
  // Purple variant
  purple: {
    primary: '#7B2CBF',
    secondary: '#00D4FF',
    accent: '#FF6B35',
    primaryRgb: '123, 44, 191',
    secondaryRgb: '0, 212, 255',
  },
  neonCyan: {
    primary: '#00f5ff',
    secondary: '#ff00ea',
    accent: '#00f5ff',
    primaryRgb: '0, 245, 255',
    secondaryRgb: '255, 0, 234',
  },
  neonMagenta: {
    primary: '#ff00ea',
    secondary: '#00f5ff',
    accent: '#ff00ea',
    primaryRgb: '255, 0, 234',
    secondaryRgb: '0, 245, 255',
  },
  electricPurple: {
    primary: '#a855f7',
    secondary: '#06b6d4',
    accent: '#a855f7',
    primaryRgb: '168, 85, 247',
    secondaryRgb: '6, 182, 212',
  },
  neonGreen: {
    primary: '#00ff88',
    secondary: '#ff6600',
    accent: '#00ff88',
    primaryRgb: '0, 255, 136',
    secondaryRgb: '255, 102, 0',
  },
  sunsetOrange: {
    primary: '#ff6600',
    secondary: '#ff00ea',
    accent: '#ff6600',
    primaryRgb: '255, 102, 0',
    secondaryRgb: '255, 0, 234',
  },
  electricBlue: {
    primary: '#0080ff',
    secondary: '#00ff88',
    accent: '#0080ff',
    primaryRgb: '0, 128, 255',
    secondaryRgb: '0, 255, 136',
  },
  cyberYellow: {
    primary: '#f0ff00',
    secondary: '#ff3366',
    accent: '#f0ff00',
    primaryRgb: '240, 255, 0',
    secondaryRgb: '255, 51, 102',
  },
  neonRed: {
    primary: '#ff3366',
    secondary: '#00f5ff',
    accent: '#ff3366',
    primaryRgb: '255, 51, 102',
    secondaryRgb: '0, 245, 255',
  },
};

export type ThemeMode = 'dark' | 'light';
export type ThemeColorKey = keyof typeof themeColors;

// ============================================================================
// Mode-specific colors
// ============================================================================

const lightModeColors = {
  background: '#f0f4f8',
  backgroundSubtle: '#e2e8f0',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  surfaceOverlay: '#f8fafc',
  border: 'rgba(0, 0, 0, 0.1)',
  borderSubtle: 'rgba(0, 0, 0, 0.05)',
  borderHover: 'rgba(0, 0, 0, 0.2)',
  textPrimary: '#0a0a14',
  textSecondary: '#3a3a4a',
  textMuted: '#5a5a6a',
  textDim: '#8a8a9a',
  sidebarBg: 'rgba(255, 255, 255, 0.8)',
  toolbarBg: 'rgba(248, 250, 252, 0.9)',
  cardBg: 'rgba(255, 255, 255, 0.95)',
};

const darkModeColors = {
  background: '#0c0c10',
  backgroundSubtle: '#0e0e14',
  surface: '#12121a',
  surfaceElevated: '#18181f',
  surfaceOverlay: '#1e1e28',
  border: 'rgba(255, 255, 255, 0.08)',
  borderSubtle: 'rgba(255, 255, 255, 0.04)',
  borderHover: 'rgba(255, 255, 255, 0.15)',
  textPrimary: '#e8e8f0',
  textSecondary: '#a0a0b0',
  textMuted: '#6a6a7a',
  textDim: '#4a4a5a',
  sidebarBg: 'rgba(12, 12, 16, 0.95)',
  toolbarBg: 'rgba(18, 18, 26, 0.9)',
  cardBg: 'rgba(18, 18, 26, 0.95)',
};

// ============================================================================
// Storage Keys
// ============================================================================

const MODE_STORAGE_KEY = 'ursly-desktop-theme-mode';
const COLOR_STORAGE_KEY = 'ursly-desktop-theme-color';

// ============================================================================
// Theme Context
// ============================================================================

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  colorKey: ThemeColorKey;
  setColorKey: (key: ThemeColorKey) => void;
  colors: (typeof themeColors)[ThemeColorKey];
  modeColors: typeof darkModeColors;
  availableColors: typeof themeColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ============================================================================
// Apply Theme Functions
// ============================================================================

function applyThemeColors(colors: (typeof themeColors)[ThemeColorKey]) {
  const root = document.documentElement;

  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--secondary', colors.secondary);
  root.style.setProperty('--accent', colors.accent);
  root.style.setProperty('--primary-rgb', colors.primaryRgb);
  root.style.setProperty('--secondary-rgb', colors.secondaryRgb);

  // Derived colors
  root.style.setProperty('--folder-color', colors.accent);

  // Glow effects
  root.style.setProperty('--primary-glow', `rgba(${colors.primaryRgb}, 0.3)`);
  root.style.setProperty(
    '--primary-glow-strong',
    `rgba(${colors.primaryRgb}, 0.5)`,
  );
  root.style.setProperty(
    '--secondary-glow',
    `rgba(${colors.secondaryRgb}, 0.3)`,
  );
}

function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement;
  const colors = mode === 'light' ? lightModeColors : darkModeColors;

  root.style.setProperty('--background', colors.background);
  root.style.setProperty('--background-subtle', colors.backgroundSubtle);
  root.style.setProperty('--surface', colors.surface);
  root.style.setProperty('--surface-elevated', colors.surfaceElevated);
  root.style.setProperty('--surface-overlay', colors.surfaceOverlay);
  root.style.setProperty('--border', colors.border);
  root.style.setProperty('--border-subtle', colors.borderSubtle);
  root.style.setProperty('--border-hover', colors.borderHover);
  root.style.setProperty('--text-primary', colors.textPrimary);
  root.style.setProperty('--text-secondary', colors.textSecondary);
  root.style.setProperty('--text-muted', colors.textMuted);
  root.style.setProperty('--text-dim', colors.textDim);
  root.style.setProperty('--sidebar-bg', colors.sidebarBg);
  root.style.setProperty('--toolbar-bg', colors.toolbarBg);
  root.style.setProperty('--card-bg', colors.cardBg);

  root.setAttribute('data-theme', mode);
  document.body.style.backgroundColor = colors.background;
  document.body.style.color = colors.textPrimary;
}

// ============================================================================
// Theme Provider Component
// ============================================================================

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return 'dark';
  });

  const [colorKey, setColorKeyState] = useState<ThemeColorKey>(() => {
    const stored = localStorage.getItem(COLOR_STORAGE_KEY);
    if (stored && stored in themeColors) {
      return stored as ThemeColorKey;
    }
    return 'cyan'; // Default theme
  });

  const colors = themeColors[colorKey];
  const modeColors = mode === 'light' ? lightModeColors : darkModeColors;

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(MODE_STORAGE_KEY, newMode);
    applyThemeMode(newMode);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const setColorKey = useCallback((key: ThemeColorKey) => {
    setColorKeyState(key);
    localStorage.setItem(COLOR_STORAGE_KEY, key);
    applyThemeColors(themeColors[key]);
  }, []);

  // Apply theme on mount
  useEffect(() => {
    applyThemeColors(colors);
    applyThemeMode(mode);
  }, [colors, mode]);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        setMode,
        toggleMode,
        colorKey,
        setColorKey,
        colors,
        modeColors,
        availableColors: themeColors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
