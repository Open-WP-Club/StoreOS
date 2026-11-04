// Datecs FP serial protocol, pure functions (no I/O). UNTESTED against real hardware: written from
// the public Datecs FP protocol description; verify command numbers/VAT letters with your model's manual.
export const CMD = {
  OPEN: 0x30, // open fiscal receipt: Op \t Pass \t Till \t
  SALE: 0x31, // register sale: Name \t Tax \t Price \t Qty \t DiscType \t DiscValue \t
  PAY: 0x35, // payment: Mode \t Amount \t  (0 = cash, 1 = card on most firmwares)
  CLOSE: 0x38, // close fiscal receipt
  CANCEL: 0x3c, // cancel (void) open fiscal receipt
  REPORT: 0x45, // daily report: 'X' or 'Z' \t
};
export const SOH = 0x01;
export const EOT = 0x04;
export const ENQ = 0x05;
export const ETX = 0x03;
export const NAK = 0x15;
export const SYN = 0x16;

// Free text must not carry control bytes (tab is the field separator, 05/03 are frame markers).
// eslint-disable-next-line no-control-regex
export const cleanText = (s) => String(s).replace(/[\x00-\x1f\x7f]/g, ' ');

export function encodeCp1251(str) {
  const out = [];
  for (const ch of String(str)) {
    const c = ch.codePointAt(0);
    if (c < 0x80) out.push(c);
    else if (c >= 0x410 && c <= 0x44f)
      out.push(c - 0x410 + 0xc0); // А-я
    else out.push(0x3f);
  }
  return Buffer.from(out);
}

// Checksum: sum of bytes LEN..ENQ, as 4 ASCII bytes (each nibble + 0x30).
export function bcc(bytes) {
  const sum = bytes.reduce((s, b) => s + b, 0) & 0xffff;
  return Buffer.from([12, 8, 4, 0].map((sh) => ((sum >> sh) & 0xf) + 0x30));
}

// <01><LEN><SEQ><CMD><DATA><05><BCC><03>; LEN = 0x20 + 4 + data length
export function buildFrame(seq, cmd, data = '') {
  const d = encodeCp1251(data);
  const body = Buffer.concat([Buffer.from([0x20 + 4 + d.length, seq, cmd]), d, Buffer.from([ENQ])]);
  return Buffer.concat([Buffer.from([SOH]), body, bcc(body), Buffer.from([ETX])]);
}

export const nextSeq = (seq) => (seq >= 0xff ? 0x20 : seq + 1);

// Parses one response frame: <01><LEN><SEQ><CMD><DATA><04><STATUS x8><05><BCC><03>.
// Returns { seq, cmd, fields, status } or null if malformed / bad checksum.
export function parseResponse(buf) {
  const start = buf.indexOf(SOH);
  const end = buf.lastIndexOf(ETX);
  if (start < 0 || end < start + 8) return null;
  const body = buf.subarray(start + 1, end - 4); // LEN..ENQ
  if (body[body.length - 1] !== ENQ) return null;
  if (!bcc(body).equals(buf.subarray(end - 4, end))) return null;
  const eot = body.indexOf(EOT, 3);
  if (eot < 0) return null;
  const text = body.subarray(3, eot).toString('latin1');
  return {
    seq: body[1],
    cmd: body[2],
    fields: text.split('\t'),
    status: body.subarray(eot + 1, body.length - 1),
  };
}

// Device error code is the first field; "0" means OK.
export const isOk = (res) => !!res && Number(res.fields[0]) === 0;

const money = (n) => (Math.round(n * 100) / 100).toFixed(2);
const qty = (n) => String(Math.round(n * 1000) / 1000);

export const cmdOpen = (op, pass, till = 1) => `${op}\t${pass}\t${till}\t`;
// Absolute discount (DiscType 4) keeps line totals exact when a sale discount was folded in.
export const cmdSale = ({ name, taxGroup, price, quantity, discount = 0 }) =>
  `${cleanText(name).slice(0, 36)}\t${taxGroup}\t${money(price)}\t${qty(quantity)}\t${
    discount > 0 ? '4' : '0'
  }\t${discount > 0 ? money(discount) : ''}\t`;
export const cmdPay = (mode, amount) => `${mode === 'card' ? 1 : 0}\t${money(amount)}\t`;
