# Native Windows review package

Internal testing candidate only. Building an installer does not authorize its
publication, sale, signing purchases, client email or deployment. The existing
GitHub review branch is separate from main and Project HQ's installed snapshot.

## Developer build

Use an existing official NSIS distribution with its `COPYING` notice and the
Windows .NET Framework C# compiler. This build does not download tools or add
dependencies. End users do not run these developer commands.

```powershell
./packaging/build-review.ps1 -NsisCompiler 'C:\path\to\NSIS\makensis.exe'
```

Output: `output/windows-review/PricingPilot-Review-Setup.exe` (ignored by Git).
Use `-OutputDirectory` with a new subdirectory of this checkout's `output`
folder to retain previous candidates and their recorded checksums. Paths outside
that output tree are rejected before compilation or directory creation.
The launcher validates local assets and locates Edge in standard installed
locations; it does not invoke a shell, run Node, download anything or call AI.
`PricingPilot.exe --check` tests required assets and Edge availability without
opening a browser window. Unknown options fail.

The normal installer uses the current Windows account and a fixed
`%LOCALAPPDATA%/Programs/PricingPilot Review` directory. It creates Desktop and
Start Menu shortcuts and an uninstall entry. An existing folder without this
product's install marker is rejected rather than overwritten. Uninstall checks
both the fixed directory and product marker and removes only enumerated files;
it never recursively deletes user directories or clears browser data.
NSIS distribution notices are bundled as `NSIS-COPYING.txt`. The installer uses
the zlib compression configuration, not extra third-party application libraries.

## Isolated acceptance checks

Compile with `-QaInstallRoot` pointing to a fresh subdirectory of this checkout's
`output/installer-qa`. Other paths are rejected by the build script. QA mode
redirects shortcuts into that test directory and omits real Desktop, Start Menu
and uninstall registry changes. It does not auto-launch the app.

Run the QA installer silently, then the installed launcher with `--check`, then
`node test/qa-installed-package.cjs <absolute-QA-install-directory>`. The browser
test uses a fresh synthetic Edge profile, the installed file URI, and blocked
external HTTP(S). It compares asset hashes and tests calculations, save/reload,
customer margin omission and a real downloaded full backup. Additional manual
automation verified the shortcut target, missing-asset nonzero exit and an
uninstall that preserves a synthetic unrelated-file sentinel.
`node test/qa-blocked-storage.cjs <absolute-QA-install-directory>` checks the
actual installed payload with quote-only and all-storage reads blocked, proving
temporary calculations remain usable without overwriting saved browser data.

The controlled test files were removed by their own uninstaller; the unrelated
sentinel remains as evidence. No real product installation or customer record
was removed. Use a new QA directory for another clean run.

## Remaining gates

October 23 normal Windows integration check: the unchanged October 22 package
passed a fresh per-user silent install on the development PC. The product
folder, Desktop shortcut, Start Menu folder and uninstall registration were
all absent before testing. Installed payload hashes, launcher `--check`, all
four shortcut targets and uninstall registry fields were verified. Normal
uninstall removed its files, shortcuts and registry entry while preserving a
synthetic unrelated-file sentinel. Only that generated sentinel was then removed
and the now-empty test product directory deleted, restoring pre-test absence.
No existing product, browser data or user document was touched. The retained
installer can reproduce this temporary test installation.

`test/qa-normal-install.ps1 -InstallerPath <absolute-review-installer-path>
-ExpectedHash <sha256>` reproduces this check. It requires the package to be
inside this checkout's output tree with the exact checksum, refuses any existing
normal installation/integration target, does not open a browser, and cleans up
only its newly created product targets. It never recursively deletes a folder.
This verifies shell/registry integration and launcher prerequisites, not visible
installer screens, actual shortcut-click browser launch or a clean recipient PC.

October 22 isolated rebuild: the current application source, including the
blocked-storage safeguards, was packaged separately in
`output/windows-review-20261022/PricingPilot-Review-Setup.exe` (121,783 bytes,
SHA256 `B1B1A0FEE88D1951A2E88F75563124373F21A74AE569F3A9AC1A04D6FBDF8468`).
The October 15 candidate and checksum remain unchanged. The new file is unsigned
and local only, not a published download or a cleared commercial release.

A separately compiled QA-mode installer installed into a fresh isolated path,
passed installed asset hashes, launcher `--check`, actual browser workflows and
both blocked-read scenarios, with no external app requests. Its shortcut target
was verified. Uninstall exited 0, removed the app payload and QA shortcut, and
preserved an unrelated synthetic sentinel. The in-place `_?=` QA invocation
leaves its own `Uninstall.exe` beside that sentinel; no recursive cleanup is
performed. Real Desktop/Start Menu and registry integration were omitted in QA.

- Separate clean-machine and recipient-side setup, actual shortcut-launch and
  onboarding acceptance. Development-PC normal integration is now checked,
  but neither that nor QA-mode testing proves a clean recipient installation.
- Unsigned executable/security-policy compatibility. Do not bypass warnings.
- Agreed commercial license/offer, delivery and payment/fulfillment workflow.
- Specific approval before publishing or sending any artifact/client message.

This does not establish a sale or payment and is not a promise of commercial
readiness on every supported Windows machine.
