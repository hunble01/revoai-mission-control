# Environment Profiles + Config Matrix (dev / stage / prod)

This document defines the production-ready profile structure and parity matrix for Mission Control.

## Profile files

- `env/profiles/dev.env.example`
- `env/profiles/stage.env.example`
- `env/profiles/prod.env.example`

## Required variable inventory (strict)

1. `NODE_ENV`
2. `DATABASE_URL`
3. `REDIS_URL`
4. `PORT`
5. `ADMIN_MODE`
6. `ADMIN_EMAIL`
7. `ADMIN_PASSWORD`
8. `ADMIN_TOKEN`
9. `NEXT_PUBLIC_API_URL`
10. `NEXT_PUBLIC_WS_URL`
11. `INTERNAL_API_URL`
12. `NEXT_PUBLIC_ADMIN_TOKEN`

## Config matrix

| Variable | dev | stage | prod | Notes |
|---|---|---|---|---|
| NODE_ENV | development | staging | production | explicit runtime profile |
| DATABASE_URL | localhost postgres | stage db host placeholder | prod db host placeholder | no real secrets in examples |
| REDIS_URL | localhost redis | stage redis placeholder | prod redis placeholder | required for queue/cache |
| PORT | 3001 | 3001 | 3001 | API bind |
| ADMIN_MODE | single | single | single | current auth mode |
| ADMIN_EMAIL | local admin email | stage admin email | prod admin email | operator identity |
| ADMIN_PASSWORD | `change-me` | placeholder | placeholder | rotate in stage/prod |
| ADMIN_TOKEN | `change-me` | placeholder | placeholder | must match web token |
| NEXT_PUBLIC_API_URL | localhost api | stage api domain | prod api domain | browser-facing API URL |
| NEXT_PUBLIC_WS_URL | localhost ws | stage wss domain | prod wss domain | realtime feed |
| INTERNAL_API_URL | localhost api | `http://api:3001` | `http://api:3001` | container internal routing |
| NEXT_PUBLIC_ADMIN_TOKEN | mirrors ADMIN_TOKEN | mirrors ADMIN_TOKEN | mirrors ADMIN_TOKEN | parity lock |

## Parity gaps from current state

1. Current root `.env` mixes local/container hostnames and is not profile-scoped.
2. Stage/prod placeholders were not previously codified in tracked artifacts.
3. No prior strict matrix validator existed for dev/stage/prod parity.

## Safe defaults used

- Dev uses localhost endpoints (`127.0.0.1`) for deterministic local startup.
- Stage/prod examples use placeholders only (no secrets committed).
- `NEXT_PUBLIC_ADMIN_TOKEN` mirrors `ADMIN_TOKEN` in all three profiles.

## Validation command

```bash
node scripts/validate-config-matrix.js
```

Pass condition:
- all required variables present in each profile
- no parity gaps across profiles
- safe default checks are true
