# BipolarChat

BipolarChat is a Telegram-inspired, RTL/PWA chat frontend backed by Supabase Auth, PostgreSQL and Realtime.

## What was repaired

- Fixed the fatal JavaScript syntax error in `app.js`.
- Reconnected authentication and session handling.
- Synced profile fields (`username`, `bio`, avatar) with PostgreSQL.
- Repaired private-chat creation.
- Implemented group creation.
- Implemented channel creation.
- Fixed chat-header rendering.
- Reconnected chat search and chat actions.
- Restored SVG folder icons.
- Kept folders persistent per account.
- Added idempotent Supabase schema/functions/RLS.
- Fixed the GitHub Pages workflow location.
- Application branding is BipolarChat; NovaChat is the source repository/origin name.
- Preserved the existing Telegram-inspired UI instead of replacing it with a different design.

## Supabase setup

1. Open your Supabase project.
2. Open **SQL Editor**.
3. Run the complete `schema.sql`.
4. In **Authentication → URL Configuration**, set the Site URL to:

   `https://farrokh992-eng.github.io/NovaChat/`

5. Add the same URL to the allowed redirect URLs.
6. If Google login is required, enable the Google provider and configure its OAuth callback URL in Supabase/Google.
7. Keep only the publishable/anon key in `config.js`. Never put a `service_role` or secret key in this repository.

## GitHub Pages

The workflow is located at:

`.github/workflows/deploy.yml`

In the repository settings, enable GitHub Pages using **GitHub Actions** as the build/deployment source.

## Important

`config.js` is intentionally client-side configuration. A Supabase publishable/anon key is designed to be exposed in browser applications; database access must be protected by RLS policies in `schema.sql`.
