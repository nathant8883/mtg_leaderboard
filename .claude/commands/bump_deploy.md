# Bump Version and Deploy

Increment app version, commit, push, and deploy to production.

## Steps
1. Read the current frontend version from `frontend/src/version.ts`
2. Increment the `APP_VERSION` (patch version, e.g., 1.0.20 -> 1.0.21)
3. Read the current API version from `backend/app/config.py`
4. Increment the `api_version` (patch version, e.g., 1.0.20 -> 1.0.21)
5. Commit all changes with message: "Bump version to [version] and deploy"
6. Push to remote
7. Run `/deploy` to deploy to production

## Version Files to Update

**Frontend Version:**
- File: `frontend/src/version.ts`
- Variable: `APP_VERSION`
- This is the single source of truth for the frontend version
- Used for: UI display, service worker cache naming, build identification

**Backend Version:**
- File: `backend/app/config.py`
- Variable: `api_version`
- This is the backend API version

## Service Worker Cache Versioning

**IMPORTANT:** Do NOT manually edit service worker files!

- Service worker cache names are **automatically generated** during build
- Build process reads `APP_VERSION` from `frontend/src/version.ts`
- Vite config (`frontend/vite.config.ts`) sets cache ID as `pod-pal-v${APP_VERSION}`
- Generated service worker appears in `frontend/dist/sw.js` after build
- Cache name example: `pod-pal-v1.0.21`

**Source files (edit these):**
- `frontend/src/version.ts` ✅
- `backend/app/config.py` ✅

**Generated files (do not edit):**
- `frontend/dist/sw.js` ❌
- `frontend/dev-dist/sw.js` ❌
