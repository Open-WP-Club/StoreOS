import { vi } from 'vitest';
import { isInvalidCredentials, loadFailureMessage, openSetupAction } from '../loadErrors';

describe('loadErrors', () => {
  it('detects invalid credentials', () => {
    expect(isInvalidCredentials({ code: 'invalid_credentials' })).toBe(true);
    expect(isInvalidCredentials({ code: 'offline' })).toBe(false);
    expect(isInvalidCredentials({})).toBe(false);
  });

  it('builds messages', () => {
    expect(loadFailureMessage('orders', { code: 'invalid_credentials' })).toContain('Setup');
    expect(loadFailureMessage('orders', {})).toBe('Failed to load orders. Please try again.');
  });

  it('openSetupAction navigates to /setup', () => {
    const navigate = vi.fn();
    const action = openSetupAction(navigate);
    expect(action.label).toBe('Open Setup');
    action.onClick();
    expect(navigate).toHaveBeenCalledWith('/setup');
  });
});
