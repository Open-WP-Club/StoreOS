// Apply dark mode immediately to prevent a flash. External (not inline) so the
// production CSP can forbid inline scripts.
try {
  const stored = localStorage.getItem('settings-storage');
  if (stored) {
    const data = JSON.parse(stored);
    if (data.state && data.state.theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }
} catch {
  // ignore
}
export {};
