# Connections OAuth + Local Fallback Guide

## Required provider env vars

Set these in `env/profiles/prod.env` (or runtime env):

### Shared
- `PUBLIC_API_BASE` (e.g. `http://127.0.0.1:3001`)
- `PUBLIC_APP_BASE` (e.g. `http://127.0.0.1:3000`)
- `OAUTH_STUB_MODE` (`1` for local/mock-safe mode, `0` for real OAuth)

### Email (SMTP/OAuth provider placeholder)
- `EMAIL_OAUTH_CLIENT_ID`
- `EMAIL_OAUTH_CLIENT_SECRET`
- `EMAIL_OAUTH_CALLBACK_URL`

### Facebook
- `FACEBOOK_OAUTH_CLIENT_ID`
- `FACEBOOK_OAUTH_CLIENT_SECRET`
- `FACEBOOK_OAUTH_CALLBACK_URL`

### Instagram
- `INSTAGRAM_OAUTH_CLIENT_ID`
- `INSTAGRAM_OAUTH_CLIENT_SECRET`
- `INSTAGRAM_OAUTH_CALLBACK_URL`

### LinkedIn
- `LINKEDIN_OAUTH_CLIENT_ID`
- `LINKEDIN_OAUTH_CLIENT_SECRET`
- `LINKEDIN_OAUTH_CALLBACK_URL`

## Operator connect flow

1. Open `/connections`
2. Click **Connect** on provider
3. Complete redirect callback flow
4. Provider status should become **Connected**
5. Click **Test** to validate health
6. Use **Disconnect** if needed

## Local/mock fallback mode

For local-only testing without real OAuth credentials:
- Set `OAUTH_STUB_MODE=1`
- Connect/Test/Disconnect still work in stub-safe mode
- No real provider token exchange occurs

## Security notes

- API responses do **not** expose raw tokens
- UI only receives safe `tokenMeta` (e.g. `hasToken`)
- Use strong session/auth secrets in production
