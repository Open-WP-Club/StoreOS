import type { ToastAction } from '../hooks/useToast';

export function isInvalidCredentials(result: { code?: string }): boolean {
  return result.code === 'invalid_credentials';
}

export function loadFailureMessage(what: string, result: { code?: string }): string {
  return isInvalidCredentials(result)
    ? `Invalid credentials – check the store keys in Setup (${what} not loaded).`
    : `Failed to load ${what}. Please try again.`;
}

/** Toast action that jumps to the Setup page (for invalid_credentials failures). */
export function openSetupAction(navigate: (to: string) => void): ToastAction {
  return { label: 'Open Setup', onClick: () => navigate('/setup') };
}
