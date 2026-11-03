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

## Auto-update (GitHub Releases)

`electron-updater` reads `build.publish` (GitHub, Open-WP-Club/StoreOS). The main process only checks in packaged builds and
when `STOREOS_DISABLE_UPDATER` is not `1` (the e2e launcher sets it). Download and restart-to-install are explicit user
clicks (Settings > Updates); IPC `updater:*` is gated by `isTrustedSender`.

- **macOS**: updates (Squirrel.Mac) require a code-signed app; with the current ad-hoc/unsigned builds the install step
  fails. Sign + notarize (see above) before relying on auto-update on macOS. Users on unsigned builds must reinstall manually.
- **Windows**: works unsigned but triggers SmartScreen; publisher verification only applies to signed builds.
- **Linux**: only AppImage auto-updates (deb/rpm are manual).
- Releases must include `latest.yml`, `latest-mac.yml`, `latest-linux.yml` (+ `.blockmap`) next to the installers;
  `.github/workflows/release.yml` uploads them. The app's `package.json` version must match the tag.

### macOS checklist for updates to install (not configured; document only)
- **Signed + notarized app**: Squirrel.Mac refuses updates for unsigned/ad-hoc builds. Needs a Developer ID Application
  cert (`CSC_LINK`/`CSC_KEY_PASSWORD`) and notarization (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`).
  The ad-hoc re-sign in `scripts/adhocSign.cjs` is for local e2e builds only and is not valid for updates.
- **Hardened runtime + entitlements**: `mac.hardenedRuntime: true` and an entitlements plist
  (`com.apple.security.cs.allow-jit`, `allow-unsigned-executable-memory` for Electron V8; add
  `disable-library-validation` only if a native module needs it) via `mac.entitlements`/`entitlementsInherit`.
- **Publish config**: `build.publish` (github, `Open-WP-Club/StoreOS`) is set. Publish with
  `electron-builder --publish always` and `GH_TOKEN`; the release must be published (not draft).
- **Update metadata**: electron-builder uploads `latest-mac.yml` next to the artifacts; the updater reads it.
- **zip target is mandatory**: macOS updates are applied from the `.zip` (already in `build.mac.target`, x64 + arm64);
  the dmg is only for first installs.
- `e2e:build` passes `-c.publish=null`, so e2e builds never contact GitHub.
