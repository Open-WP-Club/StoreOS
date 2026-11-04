import { buildWinRawPrint } from '../winRawPrint';

describe('buildWinRawPrint', () => {
  it('passes printer and bytes via env, not the script', () => {
    const r = buildWinRawPrint("Evil'; calc #", Buffer.from([0x1b, 0x70, 0x00]), { A: '1' });
    expect(r.file).toBe('powershell.exe');
    expect(r.env).toMatchObject({ A: '1', STOREOS_PRINTER: "Evil'; calc #" });
    expect(Buffer.from(r.env.STOREOS_RAW_DATA, 'base64')).toEqual(Buffer.from([0x1b, 0x70, 0x00]));
    const script = Buffer.from(r.args[r.args.length - 1], 'base64').toString('utf16le');
    expect(script).not.toContain('calc');
    expect(script).toContain('WritePrinter');
  });
});
