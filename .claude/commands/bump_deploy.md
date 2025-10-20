# Bump Version and Deploy

Increment app version, commit, push, and deploy to production.

Steps:
1. Read the current frontend version from `frontend/src/version.ts`
2. Increment the APP_VERSION (patch version, e.g., 1.0.15 -> 1.0.16)
3. Read the current API version from `backend/app/config.py`
4. Increment the api_version (patch version, e.g., 1.0.15 -> 1.0.16)
5. Commit all changes with message: "Bump version to [version] and deploy"
6. Push to remote
7. Run `/deploy` to deploy to production

Be sure to update both:
- `APP_VERSION` in `frontend/src/version.ts` (single source for frontend version and cache naming)
- `api_version` in `backend/app/config.py` (backend API version)

Note: Service worker cache names are automatically generated from APP_VERSION via vite-plugin-pwa config.
