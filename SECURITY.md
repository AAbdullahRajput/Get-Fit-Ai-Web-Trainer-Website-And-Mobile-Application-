# Security Policy

## Secrets & Environment Variables

This project stores all secrets in **environment variables** that are loaded at
runtime. **Never** commit real credentials to version control.

The following files contain secrets and are already gitignored:

| File | Purpose |
|------|---------|
| `mobile/.env` | Supabase + Agora keys for the Flutter app |
| `frontend/.env` | Supabase + Agora keys for the web app |
| `server/.env` | Supabase service-role key + internal API secret |
| `mobile/android/key.properties` | Android keystore passwords |
| `mobile/android/app/google-services.json` | Firebase credentials |
| `mobile/android/local.properties` | Local SDK paths |

Use the `.env.example` templates in each folder as a reference for the required
variables. Copy them to `.env` and supply your own values.

## Reporting a Vulnerability

If you discover a security vulnerability, **do not** open a public issue.
Contact the repository owner privately to report it.

## Android Keystore

The Android release keystore (`getfit-upload.jks`) and its password file
(`key.properties`) must **never** be committed. If you suspect either has been
leaked, rotate the keystore and update the signing configuration immediately.
