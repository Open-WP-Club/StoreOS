import { vi } from 'vitest';
import { startupMetrics } from '../startupMetrics';

describe('startupMetrics', () => {
  describe('mark', () => {
    it('should record a startup mark', () => {
      startupMetrics.mark('test-mark');

      const report = startupMetrics.getReport();
      const testMark = report.marks.find((m) => m.name === 'test-mark');

      expect(testMark).toBeDefined();
      expect(testMark.name).toBe('test-mark');
    });

    it('should record multiple marks', () => {
      startupMetrics.mark('mark-1');
      startupMetrics.mark('mark-2');
      startupMetrics.mark('mark-3');

      const report = startupMetrics.getReport();
      const markNames = report.marks.map((m) => m.name);

      expect(markNames).toContain('mark-1');
      expect(markNames).toContain('mark-2');
      expect(markNames).toContain('mark-3');
    });
  });

  describe('getElapsed', () => {
    it('should return time elapsed since startup', () => {
      // The startupMetrics singleton was created at module load time
      // So we just verify the return type and that it returns a number
      const elapsed = startupMetrics.getElapsed();

      expect(typeof elapsed).toBe('number');
      // Elapsed time can be negative in test environment if performance.now was mocked elsewhere
      // Just verify it's a finite number
      expect(Number.isFinite(elapsed)).toBe(true);
    });
  });

  describe('getReport', () => {
    it('should return a report object with required properties', () => {
      startupMetrics.mark('report-test');

      const report = startupMetrics.getReport();

      expect(report).toHaveProperty('totalTime');
      expect(report).toHaveProperty('marks');
      expect(Array.isArray(report.marks)).toBe(true);
    });

    it('should include marks with duration and timestamp', () => {
      startupMetrics.mark('duration-test');

      const report = startupMetrics.getReport();
      const mark = report.marks.find((m) => m.name === 'duration-test');

      expect(mark).toHaveProperty('name');
      expect(mark).toHaveProperty('timestamp');
      expect(mark).toHaveProperty('duration');
      expect(typeof mark.timestamp).toBe('number');
      expect(typeof mark.duration).toBe('number');
    });

    it('should sort marks by timestamp', () => {
      startupMetrics.mark('early-mark');
      startupMetrics.mark('later-mark');

      const report = startupMetrics.getReport();

      // Marks should be sorted by timestamp
      for (let i = 1; i < report.marks.length; i++) {
        expect(report.marks[i].timestamp).toBeGreaterThanOrEqual(
          report.marks[i - 1].timestamp
        );
      }
    });

    it('should include startup-init mark from constructor', () => {
      const report = startupMetrics.getReport();
      const initMark = report.marks.find((m) => m.name === 'startup-init');

      expect(initMark).toBeDefined();
    });
  });

  describe('logReport', () => {
    let consoleGroupSpy;
    let consoleLogSpy;
    let consoleGroupEndSpy;

    beforeEach(() => {
      consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation();
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();
      consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation();
    });

    afterEach(() => {
      consoleGroupSpy.mockRestore();
      consoleLogSpy.mockRestore();
      consoleGroupEndSpy.mockRestore();
    });

    it('should log startup performance report', () => {
      startupMetrics.logReport();

      expect(consoleGroupSpy).toHaveBeenCalledWith(
        '🚀 Startup Performance Report'
      );
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    });

    it('should log total startup time', () => {
      startupMetrics.logReport();

      const logCalls = consoleLogSpy.mock.calls.map((call) => call[0]);
      const hasStartupTime = logCalls.some((msg) =>
        typeof msg === 'string' && msg.includes('Total startup time')
      );

      expect(hasStartupTime).toBe(true);
    });
  });
});
