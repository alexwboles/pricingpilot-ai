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

The controlled test files were removed by their own uninstaller; the unrelated
sentinel remains as evidence. No real product installation or customer record
was removed. Use a new QA directory for another clean run.

## Remaining gates

- Separate clean-machine and recipient-side normal setup/shortcut/uninstall
  acceptance; the QA-mode test does not prove these integrations.
- Unsigned executable/security-policy compatibility. Do not bypass warnings.
- Agreed commercial license/offer, delivery and payment/fulfillment workflow.
- Specific approval before publishing or sending any artifact/client message.

This does not establish a sale or payment and is not a promise of commercial
readiness on every supported Windows machine.
