// electron-builder afterSign hook. Flipping Electron fuses rewrites the binary, which breaks
// its signature; with no signing identity the app is then SIGKILLed on launch on Apple Silicon
// ("Code Signature Invalid"). If the bundle does not verify, ad-hoc re-sign it. A properly
// signed (real identity) bundle verifies and is left untouched.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  try {
    execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'ignore' });
  } catch {
    console.log('  • ad-hoc signing (no valid signature after fuse flip)');
    execFileSync('codesign', ['--force', '--deep', '-s', '-', app], { stdio: 'inherit' });
  }
};
