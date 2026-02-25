// Theme utility
import type { ThemeMode } from '$lib/types';
import { storage } from '$lib/services/storage';

export function getEffectiveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function applyTheme(mode: ThemeMode): void {
  const effective = getEffectiveTheme(mode);
  document.documentElement.classList.toggle('dark', effective === 'dark');
}

export async function initTheme(): Promise<ThemeMode> {
  const mode = await storage.getThemeMode();
  applyTheme(mode);

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    storage.getThemeMode().then(applyTheme);
  });

  // Listen for storage changes to sync theme
  storage.onChanged((changes) => {
    if (changes.themeMode?.newValue) {
      applyTheme(changes.themeMode.newValue as ThemeMode);
    }
  });

  return mode;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function formatDelay(delay: number | undefined | null): string {
  if (delay == null || delay <= 0) return '-';
  return `${delay}ms`;
}

export function getDelayColor(delay: number | undefined | null): string {
  if (delay == null || delay <= 0) return 'text-[var(--color-text-muted)]';
  if (delay < 200) return 'text-[var(--color-success)]';
  if (delay < 500) return 'text-yellow-500';
  return 'text-[var(--color-danger)]';
}

export function getLatestDelay(history: { delay: number }[] | undefined): number | null {
  if (!history || history.length === 0) return null;
  return history[history.length - 1].delay;
}
