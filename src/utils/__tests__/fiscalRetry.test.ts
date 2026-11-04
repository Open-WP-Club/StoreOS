import { retryPending, loadPending, confirmNotPrinted } from '../fiscal';

const cfg = { port: '/dev/x', baud: 9600, operator: '1', password: '0' };
const sale = { lines: [], payments: [] };
const seed = (): void =>
  localStorage.setItem(
    'fiscal_pending',
    JSON.stringify([
      { id: 'a', sale, error: 'e', ambiguous: false },
      { id: 'b', sale, error: 'e', ambiguous: false },
    ])
  );
const setApi = (fn: unknown): void => {
  (window as unknown as { electronAPI: unknown }).electronAPI = { fiscal: { sale: fn } };
};

describe('retryPending ambiguity', () => {
  beforeEach(() => localStorage.clear());

  it('persists ambiguous on an ambiguous result, stops, and skips it next time', async () => {
    seed();
    const fn = vi.fn().mockResolvedValue({ success: false, error: 'close', ambiguous: true });
    setApi(fn);
    await retryPending(cfg);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(loadPending()[0]).toMatchObject({ ambiguous: true, error: 'close' });
    fn.mockResolvedValue({ success: true });
    expect(await retryPending(cfg)).toEqual({ done: 1, left: 1 });
    expect(loadPending()[0]?.id).toBe('a');
  });

  it('treats an IPC rejection as ambiguous; operator confirmation re-enables retry', async () => {
    seed();
    setApi(vi.fn().mockRejectedValue(new Error('ipc gone')));
    await retryPending(cfg);
    expect(loadPending()[0]).toMatchObject({ ambiguous: true, error: 'ipc gone' });
    confirmNotPrinted('a');
    expect(loadPending()[0]?.ambiguous).toBe(false);
  });

  it('plain failures stay retryable and record the new error', async () => {
    seed();
    setApi(vi.fn().mockResolvedValue({ success: false, error: 'busy' }));
    await retryPending(cfg);
    expect(loadPending()[0]).toMatchObject({ ambiguous: false, error: 'busy' });
  });
});
