import fs from 'fs';
import { execFile } from 'child_process';
import {
  CMD,
  NAK,
  SYN,
  ETX,
  buildFrame,
  nextSeq,
  parseResponse,
  isOk,
  cmdOpen,
  cmdSale,
  cmdPay,
} from './fiscalProtocol';

// Datecs FP driver over any duck-typed port ({ write(buf), on('data', cb), off? }).
// UNTESTED on real hardware; unit-tested with a fake port only.
export class DatecsDriver {
  constructor(port, { operator = '1', password = '0000', till = 1, timeoutMs = 3000 } = {}) {
    this.port = port;
    this.operator = operator;
    this.password = password;
    this.till = till;
    this.timeoutMs = timeoutMs;
    this.seq = 0x1f;
    this.buf = Buffer.alloc(0);
  }

  // One request/response. NAK -> resend (3x); SYN means "busy", the timer is extended.
  request(cmd, data = '') {
    this.seq = nextSeq(this.seq);
    const frame = buildFrame(this.seq, cmd, data);
    return new Promise((resolve, reject) => {
      let tries = 0;
      let timer;
      const done = (fn, v) => {
        clearTimeout(timer);
        this.port.off?.('data', onData);
        fn(v);
      };
      const arm = () => {
        clearTimeout(timer);
        timer = setTimeout(() => done(reject, new Error('fiscal device timeout')), this.timeoutMs);
      };
      const onData = (chunk) => {
        this.buf = Buffer.concat([this.buf, chunk]);
        for (;;) {
          const b = this.buf[0];
          if (b === SYN) {
            this.buf = this.buf.subarray(1);
            arm();
          } else if (b === NAK) {
            this.buf = this.buf.subarray(1);
            if (++tries > 3) return done(reject, new Error('fiscal device NAK'));
            this.port.write(frame);
            arm();
          } else break;
        }
        const end = this.buf.indexOf(ETX);
        if (end < 0) return;
        const res = parseResponse(this.buf.subarray(0, end + 1));
        this.buf = this.buf.subarray(end + 1);
        if (res && res.seq === this.seq) done(resolve, res);
      };
      this.buf = Buffer.alloc(0);
      this.port.on('data', onData);
      arm();
      this.port.write(frame);
    });
  }

  async call(cmd, data) {
    const res = await this.request(cmd, data);
    if (!isOk(res)) throw new Error(`fiscal error ${res.fields[0]}`);
    return res;
  }

  openReceipt() {
    return this.call(CMD.OPEN, cmdOpen(this.operator, this.password, this.till));
  }
  addLine(line) {
    return this.call(CMD.SALE, cmdSale(line));
  }
  pay(mode, amount) {
    return this.call(CMD.PAY, cmdPay(mode, amount));
  }
  closeReceipt() {
    return this.call(CMD.CLOSE, '');
  }
  cancelReceipt() {
    return this.call(CMD.CANCEL, '');
  }
  report(kind) {
    return this.call(CMD.REPORT, `${kind === 'Z' ? 'Z' : 'X'}\t`);
  }

  // Whole receipt; voids it if anything fails before close. If close itself fails the state is
  // unknown, so the error says so and the caller must NOT blindly retry.
  async sale({ lines, payments }) {
    await this.openReceipt();
    try {
      for (const l of lines) await this.addLine(l);
      for (const p of payments) await this.pay(p.method, p.amount);
    } catch (e) {
      await this.cancelReceipt().catch(() => {});
      throw e;
    }
    try {
      await this.closeReceipt();
    } catch (e) {
      const err = new Error('close failed, receipt state unknown: ' + e.message);
      err.ambiguous = true;
      throw err;
    }
  }
}

const PORT_RE = /^(\/dev\/[\w.-]+|COM\d{1,3})$/;
const BAUDS = [9600, 19200, 38400, 57600, 115200];

export function validateConfig(c) {
  if (!c || typeof c.port !== 'string' || !PORT_RE.test(c.port)) return 'invalid port';
  if (!BAUDS.includes(c.baud)) return 'invalid baud';
  for (const k of ['operator', 'password']) {
    if (typeof c[k] !== 'string' || !/^\d{1,8}$/.test(c[k])) return `invalid ${k}`;
  }
  return null;
}

const TAX_GROUPS = new Set([...'АБВГДЕЖЗ']);
const num = (n, min = 0) => typeof n === 'number' && Number.isFinite(n) && n >= min;

// Shape check for the fiscal:sale payload; returns an error string or null.
export function validateSale(p) {
  if (!p || !Array.isArray(p.lines) || !p.lines.length || p.lines.length > 200)
    return 'invalid sale';
  if (!Array.isArray(p.payments) || !p.payments.length || p.payments.length > 10) {
    return 'invalid sale';
  }
  for (const l of p.lines) {
    if (!l || typeof l.name !== 'string' || !TAX_GROUPS.has(l.taxGroup)) return 'invalid line';
    if (!num(l.price) || !num(l.quantity) || l.quantity <= 0) return 'invalid line';
    if (l.discount !== undefined && !num(l.discount)) return 'invalid line';
  }
  for (const y of p.payments) {
    if (!y || (y.method !== 'cash' && y.method !== 'card') || !num(y.amount)) {
      return 'invalid payment';
    }
  }
  return null;
}

// No native dependency: configure the tty with stty/mode, then use plain file streams.
export async function openSerial(path, baud) {
  const win = process.platform === 'win32';
  await new Promise((resolve, reject) => {
    const args = win
      ? ['mode', [path, `BAUD=${baud}`, 'PARITY=n', 'DATA=8', 'STOP=1']]
      : [
          'stty',
          [process.platform === 'darwin' ? '-f' : '-F', path, String(baud), 'raw', '-echo', 'cs8'],
        ];
    execFile(args[0], args[1], (err) => (err ? reject(err) : resolve()));
  });
  const fd = fs.openSync(win ? `\\\\.\\${path}` : path, 'r+');
  const rs = fs.createReadStream('', { fd, autoClose: false });
  return {
    on: (ev, cb) => rs.on(ev, cb),
    off: (ev, cb) => rs.off(ev, cb),
    write: (b) => fs.writeSync(fd, b),
    close: () => {
      rs.destroy();
      fs.closeSync(fd);
    },
  };
}

// Registers fiscal:sale / fiscal:report. `open` is injectable for tests.
export function registerFiscal(ipcMain, isTrustedSender, open = openSerial) {
  let busy = false;
  const run = async (event, payload, fn) => {
    if (!isTrustedSender(event)) return { success: false, error: 'untrusted' };
    const bad = validateConfig(payload && payload.config);
    if (bad) return { success: false, error: bad };
    if (busy) return { success: false, error: 'fiscal device busy' };
    busy = true;
    let port;
    try {
      const c = payload.config;
      port = await open(c.port, c.baud);
      await fn(new DatecsDriver(port, { operator: c.operator, password: c.password }));
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e && e.message), ambiguous: !!(e && e.ambiguous) };
    } finally {
      busy = false;
      try {
        port && port.close();
      } catch {
        /* ignore */
      }
    }
  };
  ipcMain.handle('fiscal:sale', (event, p) => {
    const bad = validateSale(p);
    if (bad) return { success: false, error: bad };
    return run(event, p, (d) => d.sale({ lines: p.lines, payments: p.payments }));
  });
  ipcMain.handle('fiscal:report', (event, p) =>
    run(event, p, (d) => d.report(p && p.kind === 'Z' ? 'Z' : 'X'))
  );
}
