---
description: Start MTG Leaderboard development servers (backend + frontend)
---

Start both the backend and frontend development servers:

**Backend:** Port 7777
**Frontend:** Port 5173

```bash
cd /home/nturner/PersonalRepos/MTGLeaderboard/backend && uv run uvicorn app.main:app --reload --port 7777 &
cd /home/nturner/PersonalRepos/MTGLeaderboard/frontend && npm run dev &
```

Access the app at: http://localhost:5173
