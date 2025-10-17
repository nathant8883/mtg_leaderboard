---
description: Deploy MTG Leaderboard to homeserver via SSH
---

Run the deployment script to update the homeserver:

```bash
./deploy.sh
```

This will:
1. Pull the latest code from GitHub
2. Rebuild and restart Docker containers
3. Deploy all changes to production
