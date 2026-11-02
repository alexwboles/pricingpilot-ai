# Portable handoff development record

## Plan and requirements

Goal: make a review copy easier to open without installing an unsigned program
or asking a recipient to run developer commands. No spending or new dependencies.
The existing offline calculator, privacy and backup behavior must be preserved.

Acceptance: one extracted folder opens through Edge's normal Open with action;
all referenced local assets are included; no credentials, customer records,
developer output or executable setup; existing output folders are never replaced;
an explicit file/hash manifest identifies the payload; a first-use checklist
checks calculation, persistence, customer privacy and recoverable backup.

## Design and development

An allowlisted PowerShell developer builder produces a ZIP with the unchanged
app assets and a START-HERE guide. It accepts only a new path below this
checkout's ignored output directory, rejects redirected sources/ancestors, and
does not install, run the app, alter browser settings or delete anything.

The customer opens index.html using Edge. No new launcher, server, accounts,
checkout, cloud service, telemetry or AI requests are introduced. Browser records
remain in the recipient's profile; the extracted folder is not a data backup.

## Verification and release

Record source tests, package extraction/hash and asset-reference checks and
failure-path results with the dated candidate. Verify the actual recipient
workflow using START-HERE, including the downloaded backup. Do not infer user
acceptance from file integrity or a calculator unit test.

Automated browser access to local file URLs was denied by the browser security
policy on November 2. No alternate browser surface or HTTP proxy is used to
work around that denial. Recipient-side launch/first-use acceptance remains
unverified until someone performs the normal workflow and reports the result.
No package publication, sale, customer delivery or charge occurs by building it.

## Maintenance

Retain previous packages/checksums and source revisions. Before updating, have
the recipient download and verify a full JSON backup; preserve the old folder.
Use their reported step/error/version to reproduce bugs with synthetic inputs.
Do not ask for customer data or credentials just to diagnose onboarding.

## November 2 verification record

- Source smoke: 25 passed; core/asset checks: 21 passed. These run real core
  functions and controlled handlers, not the recipient browser interface.
- Built an isolated initial ZIP, extracted it, and checked all seven payload
  files against source and the SHA256/size manifest. The archive contains only
  the explicit payload plus the manifest; all HTML asset references resolve
  locally, with no external HTML assets.
- Rebuilding at the same target was rejected with the existing ZIP byte hash
  unchanged. An outside-output target was rejected before any path was created.
- Updated the user guide's old Windows integration status to match the already
  recorded October 23 normal per-user installation/removal check.
- The final candidate must be rebuilt from the clean committed revision and
  its extracted payload checked before delivery. Recipient launch is still open.
