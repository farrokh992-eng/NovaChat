# BipolarChat — engineering audit (2026-10-11)

## Scope and evidence
Reviewed the supplied `BipolarChat-Blue-Redesign.zip` locally. This is a static source review; the live Supabase project, domain DNS, GitHub Actions, and browser-based flows were not accessible from this environment. Nothing in this report claims a live deployment or live database change.

## Changes made in this package
- Removed the duplicate SVG favicon declaration and corrected its MIME type in `index.html`.
- Replaced the beige WhatsApp-like chat wallpaper with a pale-blue background; kept outgoing messages blue and changed the green verified accent to blue.
- Added `supabase/security_hardening.sql`, a reviewed migration proposal that replaces recursive membership/admin RLS policies with `SECURITY DEFINER` membership helpers and restricts posting to channels to channel admins.
- Added this audit and release checklist.

## High-priority risks found
1. **Profile email exposure:** `schema.sql` grants all authenticated users `SELECT` on all profile rows (`using (true)`), while `profiles` includes email. This makes account email addresses visible to any authenticated user through the API. Fix needs a safe public-profile lookup RPC/view plus updates to owner/admin/user-search UI; do not simply revoke the email column without adapting those flows.
2. **Channel posting authorization:** existing `members send messages` policy permits any member to insert a message into any conversation they belong to, including channels. The proposed SQL patch limits channel posting to an admin/owner membership.
3. **Recursive RLS policies:** membership/admin select policies query the same RLS-protected tables. Depending on execution context this can cause recursive-policy errors. The proposed SQL patch replaces the self-reference with narrowly scoped `SECURITY DEFINER` helper functions.
4. **Long-lived media links:** uploads store a signed URL with a one-year expiry directly in `messages.file_url`. Anyone who obtains that URL may use it while it remains valid. A proper fix is to store the object path and generate short-lived signed URLs after checking conversation membership; shortening the expiry alone would break old message attachments.
5. **Fake two-factor UI:** `saveTwoFactor()` only shows a message; it does not enable Supabase MFA. Do not describe this as active 2FA. Configure and test Supabase Auth MFA (TOTP) before relying on it.
6. **Stories not implemented:** no story table or complete story UI/expiry/audience flow was found in the supplied archive. This remains a feature project, not a cosmetic fix.
7. **Supabase project configuration is external:** email confirmation, CAPTCHA, Auth rate limits, redirect allowlist, Storage bucket policies, backups, and live RLS state cannot be verified from this ZIP.

## Safe rollout plan
1. Take a database backup and export current SQL/policies before any SQL change.
2. Apply `supabase/security_hardening.sql` first to a staging project and test with two regular accounts, a group owner, a channel owner, and a channel member.
3. Confirm a non-admin channel member cannot insert messages; channel admin can; non-members cannot read private messages; group members still can chat.
4. Build a dedicated public profile endpoint that returns only safe fields, and move email lookup / owner management behind an owner-authorized RPC. Then remove broad email exposure.
5. Replace stored one-year signed URLs with storage object paths and short-lived URLs minted only after membership authorization.
6. Implement stories with media path, audience rules, created/expiry timestamps, and storage access policies; test expiry and cross-account access.
7. Configure Supabase Auth: email confirmation, rate limits, CAPTCHA where supported, redirect allowlist for `https://web.bipolarchat.ir/**`, and MFA for owner/admins.
8. Run end-to-end smoke tests on both domains and monitor Supabase logs before inviting the public.

## Deployment/domain notes
- The current GitHub Pages workflow deploys the repository root and the included `CNAME` names `web.bipolarchat.ir`; that is appropriate for the web app, not automatically for the marketing site at `bipolarchat.ir`.
- `main-site.html` is not the default GitHub Pages entry point. The root domain needs a separate hosting/deployment target or a dedicated build step that publishes the marketing page as that host's `index.html`.
- Never place a Supabase `service_role` key in browser code. The current config contains a publishable client key, which is intended to be public; database security must be enforced by RLS/RPC policies.

## Verification run in this environment
- `node --check app.js`: passed.
- JSON parse of `package.json`, `manifest.webmanifest`, `capacitor.config.json`: passed (where applicable).
- ZIP integrity: checked after packaging.
- Not run: live Supabase tests, full browser E2E, live domain checks, database migration execution, deployment, or Android build.
