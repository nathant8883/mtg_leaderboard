# Bump Version and Deploy

Increment cache version, app version, commit, push, and deploy to production.

Steps:
1. Read the current service worker cache version from `frontend/public/sw.js`
2. Increment the cache version (e.g., v8 -> v9)
3. Read the current API version from `backend/app/config.py`
4. Increment the API version (patch version, e.g., 1.0.0 -> 1.0.1)
5. Commit all changes with message: "Bump version to [version] and deploy"
6. Push to remote
7. Run `/deploy` to deploy to production

Be sure to update both:
- `CACHE_NAME` in `frontend/public/sw.js`
- `api_version` in `backend/app/config.py`
