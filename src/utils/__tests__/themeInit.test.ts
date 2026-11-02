import { describe, it, expect, beforeEach, vi } from 'vitest';

async function run(): Promise<void> {
  vi.resetModules();
  await import('../../themeInit');
}

describe('themeInit', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  it('adds dark class when stored theme is dark', async () => {
    localStorage.setItem('settings-storage', JSON.stringify({ state: { theme: 'dark' } }));
    await run();
    expect(document.documentElement).toHaveClass('dark');
  });

  it('does nothing for light theme or missing storage', async () => {
    await run();
    expect(document.documentElement).not.toHaveClass('dark');
    localStorage.setItem('settings-storage', JSON.stringify({ state: { theme: 'light' } }));
    await run();
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('ignores malformed JSON', async () => {
    localStorage.setItem('settings-storage', '{bad');
    await expect(run()).resolves.toBeUndefined();
    expect(document.documentElement).not.toHaveClass('dark');
  });
});
