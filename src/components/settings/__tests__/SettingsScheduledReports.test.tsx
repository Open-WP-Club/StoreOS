import { vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsScheduledReports from '../SettingsScheduledReports';
import useScheduledReports from '../../../stores/scheduledReportsStore';

const chooseDir = vi.fn();
const setApi = (on: boolean): void => {
  (window as unknown as { electronAPI?: unknown }).electronAPI = on
    ? { reports: { chooseDir } }
    : undefined;
};

describe('SettingsScheduledReports', () => {
  beforeEach(() => {
    setApi(true);
    useScheduledReports.setState({
      enabled: false,
      outputDir: null,
      frequency: 'daily',
      reportType: 'sales-summary',
      format: 'csv',
      time: '18:00',
      notify: true,
      lastRun: null,
    });
  });
  afterEach(() => setApi(false));

  it('enable checkbox is disabled until a folder is chosen', async () => {
    chooseDir.mockResolvedValue('/tmp/reports');
    render(<SettingsScheduledReports language="en" />);
    const enable = screen.getByLabelText('Enable scheduled reports');
    expect(enable).toBeDisabled();
    fireEvent.click(screen.getByText('Choose folder'));
    await waitFor(() => expect(screen.getByText('/tmp/reports')).toBeInTheDocument());
    expect(enable).toBeEnabled();
  });

  it('keeps the old folder when the dialog is cancelled', async () => {
    chooseDir.mockResolvedValue(null);
    render(<SettingsScheduledReports language="en" />);
    fireEvent.click(screen.getByText('Choose folder'));
    await waitFor(() => expect(chooseDir).toHaveBeenCalled());
    expect(screen.getByText('No folder selected')).toBeInTheDocument();
  });

  it('disables folder + enable without Electron reports API', () => {
    setApi(false);
    useScheduledReports.setState({ outputDir: '/x' });
    render(<SettingsScheduledReports language="en" />);
    expect(screen.getByText('Choose folder')).toBeDisabled();
    expect(screen.getByLabelText('Enable scheduled reports')).toBeDisabled();
  });

  it('enabling starts the clock (lastRun set) and shows next run', () => {
    useScheduledReports.setState({ outputDir: '/x' });
    render(<SettingsScheduledReports language="en" />);
    fireEvent.click(screen.getByLabelText('Enable scheduled reports'));
    expect(useScheduledReports.getState().enabled).toBe(true);
    expect(useScheduledReports.getState().lastRun).not.toBeNull();
    expect(screen.getByText(/Next run:/)).toBeInTheDocument();
  });

  it('weekly shows weekday select; edits update the store', () => {
    render(<SettingsScheduledReports language="en" />);
    expect(screen.queryByLabelText('Weekday')).toBeNull();
    fireEvent.change(screen.getByLabelText('Frequency'), { target: { value: 'weekly' } });
    fireEvent.change(screen.getByLabelText('Weekday'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Format'), { target: { value: 'pdf' } });
    fireEvent.change(screen.getByLabelText('Report'), { target: { value: 'pos-daily' } });
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '07:15' } });
    const s = useScheduledReports.getState();
    expect([s.frequency, s.weekday, s.format, s.reportType, s.time]).toEqual([
      'weekly',
      3,
      'pdf',
      'pos-daily',
      '07:15',
    ]);
  });

  it('ignores clearing the time and renders Bulgarian labels', () => {
    render(<SettingsScheduledReports language="bg" />);
    fireEvent.change(screen.getByLabelText('Час'), { target: { value: '' } });
    expect(useScheduledReports.getState().time).toBe('18:00');
    expect(screen.getByText('Планирани отчети')).toBeInTheDocument();
  });

  it('toggles notify', () => {
    render(<SettingsScheduledReports language="en" />);
    fireEvent.click(screen.getByLabelText('Desktop notification when done'));
    expect(useScheduledReports.getState().notify).toBe(false);
  });
});
