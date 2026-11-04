import { EventEmitter } from 'events';
import {
  buildFrame,
  parseResponse,
  bcc,
  encodeCp1251,
  cmdSale,
  cmdPay,
  CMD,
} from '../fiscalProtocol';
import { DatecsDriver, validateConfig } from '../fiscal';

// Builds a device reply frame: <01><LEN><SEQ><CMD><DATA><04><STATUS x8><05><BCC><03>
function reply(seq, cmd, data) {
  const body = Buffer.concat([
    Buffer.from([0x20 + 4 + data.length + 9, seq, cmd]),
    Buffer.from(data, 'latin1'),
    Buffer.from([0x04]),
    Buffer.alloc(8, 0x80),
    Buffer.from([0x05]),
  ]);
  return Buffer.concat([Buffer.from([0x01]), body, bcc(body), Buffer.from([0x03])]);
}

// Fake serial port: answers each frame via `respond(frame) -> Buffer | null`.
function fakePort(respond) {
  const port = new EventEmitter();
  port.sent = [];
  port.write = (frame) => {
    port.sent.push(frame);
    const r = respond(frame, port.sent.length);
    if (r) setImmediate(() => port.emit('data', r));
  };
  return port;
}
const okReply = (frame) => reply(frame[2], frame[3], '0\t');

describe('frame building', () => {
  it('builds a known frame with checksum', () => {
    // LEN=0x24 SEQ=0x20 CMD=0x30 ENQ=0x05 -> sum 0x79 -> "0079" as nibble+0x30
    expect([...buildFrame(0x20, 0x30, '')]).toEqual([
      0x01, 0x24, 0x20, 0x30, 0x05, 0x30, 0x30, 0x37, 0x39, 0x03,
    ]);
  });
  it('LEN counts data and the checksum covers it', () => {
    const f = buildFrame(0x21, CMD.SALE, 'ab');
    expect(f[1]).toBe(0x20 + 4 + 2);
    expect(f.subarray(f.length - 5, f.length - 1).equals(bcc(f.subarray(1, f.length - 5)))).toBe(
      true
    );
  });
  it('encodes Cyrillic as cp1251 and strips tabs', () => {
    expect([...encodeCp1251('Аб\tя')]).toEqual([0xc0, 0xe1, 0x20, 0xff]);
  });
  it('formats sale and payment data', () => {
    expect(cmdSale({ name: 'X', taxGroup: 'Б', price: 2.5, quantity: 3, discount: 1 })).toBe(
      'X\tБ\t2.50\t3\t4\t1.00\t'
    );
    expect(cmdSale({ name: 'X', taxGroup: 'Б', price: 2, quantity: 1 })).toBe(
      'X\tБ\t2.00\t1\t0\t\t'
    );
    expect(cmdPay('card', 5)).toBe('1\t5.00\t');
    expect(cmdPay('cash', 5)).toBe('0\t5.00\t');
  });
});

describe('parseResponse', () => {
  it('parses a valid reply and rejects corruption', () => {
    const r = reply(0x22, 0x30, '0\t12\t');
    expect(parseResponse(r)).toMatchObject({ seq: 0x22, cmd: 0x30, fields: ['0', '12', ''] });
    const bad = Buffer.from(r);
    bad[3] ^= 1;
    expect(parseResponse(bad)).toBeNull();
    expect(parseResponse(Buffer.from([1, 2, 3]))).toBeNull();
  });
});

describe('DatecsDriver', () => {
  const sale = {
    lines: [{ name: 'Хляб', taxGroup: 'Б', price: 2, quantity: 1, discount: 0 }],
    payments: [{ method: 'cash', amount: 2 }],
  };

  it('runs open, lines, payment, close in order', async () => {
    const port = fakePort(okReply);
    await new DatecsDriver(port).sale(sale);
    expect(port.sent.map((f) => f[3])).toEqual([CMD.OPEN, CMD.SALE, CMD.PAY, CMD.CLOSE]);
  });

  it('cancels the receipt when a line is rejected', async () => {
    const port = fakePort((f) => reply(f[2], f[3], f[3] === CMD.SALE ? '-111001\t' : '0\t'));
    await expect(new DatecsDriver(port).sale(sale)).rejects.toThrow('-111001');
    expect(port.sent.map((f) => f[3])).toEqual([CMD.OPEN, CMD.SALE, CMD.CANCEL]);
  });

  it('flags a failed close as ambiguous', async () => {
    const port = fakePort((f) => reply(f[2], f[3], f[3] === CMD.CLOSE ? '-1\t' : '0\t'));
    await expect(new DatecsDriver(port).sale(sale)).rejects.toMatchObject({ ambiguous: true });
  });

  it('resends on NAK and waits through SYN, then times out', async () => {
    let n = 0;
    const port = fakePort((f) => (++n === 1 ? Buffer.from([0x15]) : okReply(f)));
    await new DatecsDriver(port).report('X');
    expect(port.sent).toHaveLength(2);
    const dead = fakePort(() => null);
    await expect(new DatecsDriver(dead, { timeoutMs: 20 }).report('Z')).rejects.toThrow('timeout');
  });
});

describe('validateConfig', () => {
  const ok = { port: '/dev/ttyUSB0', baud: 115200, operator: '1', password: '0000' };
  it('accepts sane config and rejects shell-ish ports', () => {
    expect(validateConfig(ok)).toBeNull();
    expect(validateConfig({ ...ok, port: 'COM3' })).toBeNull();
    expect(validateConfig({ ...ok, port: '/dev/tty; rm -rf /' })).toBe('invalid port');
    expect(validateConfig({ ...ok, port: '/etc/passwd' })).toBe('invalid port');
    expect(validateConfig({ ...ok, baud: 1 })).toBe('invalid baud');
    expect(validateConfig({ ...ok, password: 'ab' })).toBe('invalid password');
  });
});
