# BipolarChat — Stage 2 security delivery

Date: 2026-10-11

## What is actually delivered in this folder

- Existing web app source and the latest local blue redesign package.
- `supabase/security_preflight.sql`: read-only queries to inventory RLS state, all public policies, table grants, Storage policies, and `SECURITY DEFINER` functions before any change.
- `supabase/security_hardening.sql`: a **proposed** migration that addresses recursive membership-policy patterns and restricts channel message inserts to channel admins, based on the schema in this repository.
- `SECURITY_AUDIT.md`: risks found in the supplied source and safe rollout plan.
- This file: handoff status and blockers.

## Important limitations

No GitHub repository or live Supabase project was reachable from this execution environment, so no remote branch, pull request, live database, hosting configuration, or DNS record was changed. This package must not be described as a live fix.

The hardening migration is a proposal, not yet production-approved. PostgreSQL permissive policies are combined with OR semantics; any additional broad policy can undermine a narrower policy. Run the preflight query first, review *all* policies and grants, and test the migration in a staging Supabase project. Do not run it on production before a verified backup and a rollback plan.

## Priority findings from static review

1. `public.profiles` contains `email`, while the current select policy permits all authenticated users to read every profile row. This risks exposing account email addresses. Fix requires a safe public profile surface and updating search/admin flows before removing broad access.
2. The current message insert policy allows any conversation member to send, including in channels. The proposed migration restricts channel posts to channel admins, but all other policies must be reviewed for permissive overlaps.
3. Membership/admin policies in the baseline schema query their own protected tables and may trigger recursive RLS behavior.
4. Message attachments store long-lived signed URLs. Move toward storing Storage object paths and minting short-lived links only after checking conversation membership.
5. The current two-factor UI handler is not evidence of real Supabase MFA; configure and verify Supabase Auth MFA separately.
6. No complete story feature was found in the supplied source (media, audience rules, expiration, and access enforcement).
7. Auth provider settings, email confirmation, CAPTCHA, rate limits, redirect allowlist, Storage bucket privacy, and actual production RLS state cannot be proven from source code alone.

## Required runbook

1. Export schema/policies and create a recoverable database backup.
2. Run `supabase/security_preflight.sql` in the live project and save its output securely.
3. Create a staging project or branch and apply the proposed hardening there only after comparing it with the live policy inventory.
4. Test with at least four identities: private-chat user A, private-chat user B, channel owner/admin, and channel member. Verify both allowed and denied reads/writes.
5. Implement a public-profile endpoint/view that excludes email; move email lookup and owner-only operations behind authorization checks.
6. Change file messages to store object paths, then issue short-lived signed URLs after authorization checks. Plan compatibility for old links.
7. Configure email confirmation, Auth rate limits, CAPTCHA where supported, exact redirect allowlist for `https://web.bipolarchat.ir/**`, and MFA for owner/admin accounts.
8. Run end-to-end tests for signup, login, logout, password recovery, Google OAuth, private chat, group roles, channel posting, uploads, and mobile layout.
9. Only then deploy web app to `web.bipolarchat.ir`. Deploy the marketing page to `bipolarchat.ir` separately; root GitHub Pages deployment does not automatically publish `main-site.html` as `index.html`.

## Static checks

The handoff should be rechecked before release. Syntax/JSON/ZIP checks are not substitutes for live authentication, RLS, Storage, browser, or deployment tests.
