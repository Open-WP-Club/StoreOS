/**
 * Startup Metrics Utility
 *
 * Measures and reports application startup performance.
 * Helps identify bottlenecks and track improvements.
 */

interface StartupMark {
  name: string;
  timestamp: number;
}

interface StartupReport {
  totalTime: number;
  marks: Array<{
    name: string;
    timestamp: number;
    duration: number;
  }>;
  navigationTiming?: {
    domContentLoaded: number;
    load: number;
    firstPaint?: number;
    firstContentfulPaint?: number;
  };
}

class StartupMetrics {
  private marks: StartupMark[] = [];
  private startTime: number;

  constructor() {
    this.startTime = performance.now();
    this.mark('startup-init');
  }

  /**
   * Mark a point in the startup sequence
   */
  mark(name: string): void {
    this.marks.push({
      name,
      timestamp: performance.now(),
    });
  }

  /**
   * Get time elapsed since startup
   */
  getElapsed(): number {
    return performance.now() - this.startTime;
  }

  /**
   * Generate a startup report
   */
  getReport(): StartupReport {
    const sortedMarks = [...this.marks].sort((a, b) => a.timestamp - b.timestamp);

    const marksWithDuration = sortedMarks.map((mark, index) => ({
      name: mark.name,
      timestamp: Math.round(mark.timestamp - this.startTime),
      duration:
        index === 0
          ? Math.round(mark.timestamp - this.startTime)
          : Math.round(mark.timestamp - (sortedMarks[index - 1]?.timestamp ?? this.startTime)),
    }));

    const report: StartupReport = {
      totalTime: Math.round(performance.now() - this.startTime),
      marks: marksWithDuration,
    };

    // Add navigation timing if available
    if (typeof window !== 'undefined' && window.performance?.timing) {
      const timing = window.performance.timing;
      report.navigationTiming = {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        load: timing.loadEventEnd - timing.navigationStart,
      };

      // Try to get paint timing
      const paintEntries = performance.getEntriesByType('paint');
      paintEntries.forEach((entry) => {
        if (entry.name === 'first-paint') {
          report.navigationTiming!.firstPaint = Math.round(entry.startTime);
        }
        if (entry.name === 'first-contentful-paint') {
          report.navigationTiming!.firstContentfulPaint = Math.round(entry.startTime);
        }
      });
    }

    return report;
  }

  /**
   * Log the startup report to console
   */
  logReport(): void {
    const report = this.getReport();

    // eslint-disable-next-line no-console
    console.group('🚀 Startup Performance Report');
    // eslint-disable-next-line no-console
    console.log(`Total startup time: ${report.totalTime}ms`);

    // eslint-disable-next-line no-console
    console.group('Marks:');
    report.marks.forEach((mark) => {
      // eslint-disable-next-line no-console
      console.log(`  ${mark.name}: +${mark.duration}ms (total: ${mark.timestamp}ms)`);
    });
    // eslint-disable-next-line no-console
    console.groupEnd();

    if (report.navigationTiming) {
      // eslint-disable-next-line no-console
      console.group('Navigation Timing:');
      // eslint-disable-next-line no-console
      console.log(`  DOM Content Loaded: ${report.navigationTiming.domContentLoaded}ms`);
      // eslint-disable-next-line no-console
      console.log(`  Load: ${report.navigationTiming.load}ms`);
      if (report.navigationTiming.firstPaint) {
        // eslint-disable-next-line no-console
        console.log(`  First Paint: ${report.navigationTiming.firstPaint}ms`);
      }
      if (report.navigationTiming.firstContentfulPaint) {
        // eslint-disable-next-line no-console
        console.log(`  First Contentful Paint: ${report.navigationTiming.firstContentfulPaint}ms`);
      }
      // eslint-disable-next-line no-console
      console.groupEnd();
    }

    // eslint-disable-next-line no-console
    console.groupEnd();
  }
}

// Singleton instance
export const startupMetrics = new StartupMetrics();

// Export for manual usage
export default startupMetrics;
