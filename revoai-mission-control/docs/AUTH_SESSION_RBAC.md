# Auth Transition: Session + RBAC

## What changed
- Added DB-backed `User` + `Session` models.
- Added `UserRole` enum (`admin`, `operator`, `closer`, `viewer`).
- Added auth endpoints:
  - `POST /api/auth/bootstrap`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- API auth guard now requires signed session cookie `mc_session`.

## Bootstrap admin
Environment variables used:
- `BOOTSTRAP_ADMIN_EMAIL` (fallback `ADMIN_EMAIL`)
- `BOOTSTRAP_ADMIN_PASSWORD` (fallback `ADMIN_PASSWORD`)

## Login flow
1. Bootstrap admin if needed.
2. Login from `/login`.
3. API sets `mc_session` HttpOnly cookie.
4. Subsequent API calls use cookie auth (`credentials: include`).

## RBAC
- Existing role checks (`assertAdminRole`) now rely on role from authenticated session payload.
- Shared token fallback is no longer required for UI operation.
