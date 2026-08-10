# BipolarChat

BipolarChat is the application name. `NovaChat` is only the source/repository origin name.

## Reserved system identities

- Owner: `@bipolar`
- Owner email: `farrokhzad743@gmail.com`
- Official announcement channel: `@bipolar_ir`
- Official notification bot: `@notification`

## Supabase setup

1. Open the Supabase SQL Editor.
2. Run the complete `schema.sql`.
3. Enable Email/Password authentication.
4. Set the GitHub Pages URL as the Auth Site URL/redirect URL:
   `https://farrokh992-eng.github.io/NovaChat/`
5. Sign in with `farrokhzad743@gmail.com`.
6. On the first successful login, BipolarChat runs `bootstrap_bipolarchat()`.

The bootstrap is deliberately restricted to the exact owner email. Other users cannot claim ownership.

The bootstrap creates/repairs:
- the owner profile `@bipolar`
- the official channel `@bipolar_ir`
- the notification bot identity `@notification`
- the application settings record

## Verification

Only the application owner can grant or revoke user verification. Admins and ordinary users cannot verify other users.

The owner itself is permanently verified.

## Important bot note

`@notification` is a system bot identity, not a normal password-login user. Creating a real Auth user for a bot requires a trusted backend/Edge Function using a secret key and must never be done from the browser. The database already prevents ordinary users from impersonating the bot.

## Android / iOS

The web application is kept PWA-ready. The next native packaging stage can use Capacitor so the same BipolarChat frontend can become an Android application first and then an iOS application without exposing Supabase service-role credentials.
