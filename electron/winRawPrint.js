// Raw (RAW datatype) print on Windows via PowerShell + winspool.drv; no native addon.
// Printer name and bytes travel in env vars, never interpolated into the script.
const PS_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class RawPrn {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DOCINFO { public string n; public string o; public string t; }
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool OpenPrinter(string p, out IntPtr h, IntPtr d);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern int StartDocPrinter(IntPtr h, int l, [In] DOCINFO d);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr h, byte[] b, int c, out int w);
}
'@
$bytes = [Convert]::FromBase64String($env:STOREOS_RAW_DATA)
$h = [IntPtr]::Zero
if (-not [RawPrn]::OpenPrinter($env:STOREOS_PRINTER, [ref]$h, [IntPtr]::Zero)) { throw 'OpenPrinter failed' }
try {
  $d = New-Object RawPrn+DOCINFO; $d.n = 'StoreOS drawer'; $d.t = 'RAW'
  if ([RawPrn]::StartDocPrinter($h, 1, $d) -eq 0) { throw 'StartDocPrinter failed' }
  [void][RawPrn]::StartPagePrinter($h)
  $w = 0
  if (-not [RawPrn]::WritePrinter($h, $bytes, $bytes.Length, [ref]$w)) { throw 'WritePrinter failed' }
  [void][RawPrn]::EndPagePrinter($h); [void][RawPrn]::EndDocPrinter($h)
} finally { [void][RawPrn]::ClosePrinter($h) }
`;

// Returns the command to spawn for the drawer kick; stdin is unused on Windows.
export function buildWinRawPrint(printer, bytes, baseEnv = process.env) {
  return {
    file: 'powershell.exe',
    args: [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(PS_SCRIPT, 'utf16le').toString('base64'),
    ],
    env: {
      ...baseEnv,
      STOREOS_PRINTER: printer,
      STOREOS_RAW_DATA: Buffer.from(bytes).toString('base64'),
    },
  };
}
