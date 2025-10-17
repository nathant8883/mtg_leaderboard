#!/bin/bash
# Deploy MTG Leaderboard to homeserver

echo "🚀 Deploying MTG Leaderboard to homeserver..."
ssh homeserver "cd ~/mtg_leaderboard && git pull && docker compose down && docker compose up --build -d"
echo "✅ Deployment complete!"
