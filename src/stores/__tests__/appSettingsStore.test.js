import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useAppSettings from '../appSettingsStore';

describe('appSettingsStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useAppSettings.setState({
      language: 'bg',
      defaultPrinter: null,
      pinEnabled: false,
      pinCode: null,
      pinTimeout: 30,
      lastActivity: null,
      isLocked: false,
      isInitialized: false,
    });
  });

  describe('language settings', () => {
    it('should have default language as bg', () => {
      const { result } = renderHook(() => useAppSettings());
      expect(result.current.language).toBe('bg');
    });

    it('should set language', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setLanguage('en');
      });

      expect(result.current.language).toBe('en');
    });
  });

  describe('printer settings', () => {
    it('should have null default printer initially', () => {
      const { result } = renderHook(() => useAppSettings());
      expect(result.current.defaultPrinter).toBeNull();
    });

    it('should set default printer', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setDefaultPrinter('HP LaserJet');
      });

      expect(result.current.defaultPrinter).toBe('HP LaserJet');
    });

    it('should clear printer when set to null', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setDefaultPrinter('HP LaserJet');
      });

      act(() => {
        result.current.setDefaultPrinter(null);
      });

      expect(result.current.defaultPrinter).toBeNull();
    });
  });

  describe('PIN lock settings', () => {
    it('should have PIN disabled by default', () => {
      const { result } = renderHook(() => useAppSettings());

      expect(result.current.pinEnabled).toBe(false);
      expect(result.current.pinCode).toBeNull();
    });

    it('should enable PIN', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setPinEnabled(true);
      });

      expect(result.current.pinEnabled).toBe(true);
    });

    it('should clear PIN code when disabling PIN', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setPinEnabled(true);
        result.current.setPinCode('1234');
      });

      act(() => {
        result.current.setPinEnabled(false);
      });

      expect(result.current.pinCode).toBeNull();
      expect(result.current.isLocked).toBe(false);
    });

    it('should set PIN code (hashed)', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setPinCode('1234');
      });

      // PIN should be stored as a hash, not plain text
      expect(result.current.pinCode).not.toBe('1234');
      expect(result.current.pinCode).toBeTruthy();
    });

    it('should clear PIN code when set to null', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setPinCode('1234');
      });

      act(() => {
        result.current.setPinCode(null);
      });

      expect(result.current.pinCode).toBeNull();
    });

    it('should verify correct PIN', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setPinCode('1234');
      });

      expect(result.current.verifyPin('1234')).toBe(true);
    });

    it('should reject incorrect PIN', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setPinCode('1234');
      });

      expect(result.current.verifyPin('4321')).toBe(false);
      expect(result.current.verifyPin('0000')).toBe(false);
    });

    it('should return true when no PIN is set', () => {
      const { result } = renderHook(() => useAppSettings());

      expect(result.current.verifyPin('any')).toBe(true);
    });
  });

  describe('PIN timeout', () => {
    it('should have default timeout of 30 minutes', () => {
      const { result } = renderHook(() => useAppSettings());
      expect(result.current.pinTimeout).toBe(30);
    });

    it('should set PIN timeout', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setPinTimeout(60);
      });

      expect(result.current.pinTimeout).toBe(60);
    });

    it('should clamp timeout to minimum of 1 minute', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setPinTimeout(0);
      });

      expect(result.current.pinTimeout).toBe(1);
    });

    it('should clamp timeout to maximum of 120 minutes', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setPinTimeout(999);
      });

      expect(result.current.pinTimeout).toBe(120);
    });
  });

  describe('activity tracking', () => {
    it('should have null lastActivity initially', () => {
      const { result } = renderHook(() => useAppSettings());
      expect(result.current.lastActivity).toBeNull();
    });

    it('should update lastActivity', () => {
      const { result } = renderHook(() => useAppSettings());
      const beforeUpdate = Date.now();

      act(() => {
        result.current.updateLastActivity();
      });

      expect(result.current.lastActivity).toBeGreaterThanOrEqual(beforeUpdate);
    });
  });

  describe('lock/unlock', () => {
    it('should not be locked initially', () => {
      const { result } = renderHook(() => useAppSettings());
      expect(result.current.isLocked).toBe(false);
    });

    it('should lock when PIN is enabled and set', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setPinEnabled(true);
        result.current.setPinCode('1234');
      });

      act(() => {
        result.current.lock();
      });

      expect(result.current.isLocked).toBe(true);
    });

    it('should not lock when PIN is disabled', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.lock();
      });

      expect(result.current.isLocked).toBe(false);
    });

    it('should not lock when no PIN code is set', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setPinEnabled(true);
        // No PIN code set
        result.current.lock();
      });

      expect(result.current.isLocked).toBe(false);
    });

    it('should unlock and update lastActivity', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setPinEnabled(true);
        result.current.setPinCode('1234');
        result.current.lock();
      });

      expect(result.current.isLocked).toBe(true);

      const beforeUnlock = Date.now();

      act(() => {
        result.current.unlock();
      });

      expect(result.current.isLocked).toBe(false);
      expect(result.current.lastActivity).toBeGreaterThanOrEqual(beforeUnlock);
    });
  });

  describe('checkPinTimeout', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return false when PIN is disabled', () => {
      const { result } = renderHook(() => useAppSettings());

      expect(result.current.checkPinTimeout()).toBe(false);
    });

    it('should return false when no PIN code is set', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setPinEnabled(true);
      });

      expect(result.current.checkPinTimeout()).toBe(false);
    });

    it('should return true when no activity recorded', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setPinEnabled(true);
        result.current.setPinCode('1234');
      });

      expect(result.current.checkPinTimeout()).toBe(true);
    });

    it('should return false when within timeout', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setPinEnabled(true);
        result.current.setPinCode('1234');
        result.current.setPinTimeout(30); // 30 minutes
        result.current.updateLastActivity();
      });

      // Within timeout
      expect(result.current.checkPinTimeout()).toBe(false);
    });

    it('should return true and lock when timeout exceeded', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setPinEnabled(true);
        result.current.setPinCode('1234');
        result.current.setPinTimeout(1); // 1 minute
        result.current.updateLastActivity();
      });

      // Advance time past timeout
      vi.advanceTimersByTime(2 * 60 * 1000); // 2 minutes

      let shouldLock;
      act(() => {
        shouldLock = result.current.checkPinTimeout();
      });

      expect(shouldLock).toBe(true);
      expect(result.current.isLocked).toBe(true);
    });
  });

  describe('initialization', () => {
    it('should not be initialized by default', () => {
      const { result } = renderHook(() => useAppSettings());
      expect(result.current.isInitialized).toBe(false);
    });

    it('should set initialized', () => {
      const { result } = renderHook(() => useAppSettings());

      act(() => {
        result.current.setInitialized(true);
      });

      expect(result.current.isInitialized).toBe(true);
    });
  });

  describe('resetAppSettings', () => {
    it('should reset all settings to defaults', () => {
      const { result } = renderHook(() => useAppSettings());

      // Change some settings
      act(() => {
        result.current.setLanguage('en');
        result.current.setDefaultPrinter('Printer');
        result.current.setPinEnabled(true);
        result.current.setPinCode('1234');
        result.current.setPinTimeout(60);
        result.current.updateLastActivity();
        result.current.lock();
      });

      // Reset
      act(() => {
        result.current.resetAppSettings();
      });

      expect(result.current.language).toBe('bg');
      expect(result.current.defaultPrinter).toBeNull();
      expect(result.current.pinEnabled).toBe(false);
      expect(result.current.pinCode).toBeNull();
      expect(result.current.pinTimeout).toBe(30);
      expect(result.current.lastActivity).toBeNull();
      expect(result.current.isLocked).toBe(false);
    });
  });
});
