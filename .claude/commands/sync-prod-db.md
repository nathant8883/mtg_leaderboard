---
description: Copy production MongoDB data to local development database
---

Copy the production `mtg_leaderboard` database from `homeserver` to local MongoDB for development.

**Steps:**
1. Open an SSH tunnel to `homeserver:27018` (prod MongoDB) on local port `37017`
2. `mongodump` the `mtg_leaderboard` database through the tunnel
3. `mongorestore` it to local MongoDB on port `27017` (drops existing local data)
4. Clean up: kill SSH tunnel and delete dump files

```bash
# 1. SSH tunnel
ssh -f -N -L 37017:localhost:27018 homeserver

# 2. Dump prod
mongodump --host=localhost --port=37017 --db=mtg_leaderboard --out=/tmp/mtg_prod_dump

# 3. Restore locally (--drop replaces existing data)
mongorestore --host=localhost --port=27017 --db=mtg_leaderboard --drop /tmp/mtg_prod_dump/mtg_leaderboard

# 4. Cleanup
pkill -f "ssh -f -N -L 37017" || true
rm -rf /tmp/mtg_prod_dump
```

**Prerequisites:**
- `mongodump` and `mongorestore` installed locally
- Local MongoDB running on port `27017`
- SSH access to `homeserver` configured

**Note:** This replaces all local data with production data. Any local-only data will be lost.
