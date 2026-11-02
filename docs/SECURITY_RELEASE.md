# Release hardening checklist

## Electron fuses (done)
`package.json > build.electronFuses` (applied by electron-builder at pack time):
RunAsNode off, NODE_OPTIONS off, `--inspect` CLI args off, OnlyLoadAppFromAsar on.
Not enabled: `EmbeddedAsarIntegrityValidation` (verify with electron-updater + signed builds first).

## Code signing / notarization (NOT configured - needs your credentials)
- macOS: Apple Developer ID Application cert. Set `CSC_LINK` / `CSC_KEY_PASSWORD`, add
  `mac.hardenedRuntime: true` and an entitlements plist, then notarize with
  `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` (electron-builder notarizes automatically when set).
- Windows: Authenticode/EV cert via `CSC_LINK` / `CSC_KEY_PASSWORD`, or `win.azureSignOptions` (Azure Trusted Signing).
- Auto-update (`electron-updater`) only verifies signatures on signed builds; sign before shipping updates.

## Verify manually
- `npx @electron/fuses read --app <packaged app>` shows the expected fuse states.
- Packaged app starts with the production CSP (DevTools console shows no CSP violations).

## Ad-hoc re-signing (macOS, unsigned builds)
`scripts/adhocSign.cjs` (`build.afterSign`) runs `codesign --verify` after the fuse flip and ad-hoc re-signs
(`codesign --force --deep -s -`) only if verification fails; without it unsigned arm64 builds are SIGKILLed on launch.
A properly signed (real identity) bundle verifies and is left untouched.
