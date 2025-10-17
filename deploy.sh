#!/bin/bash
# Deploy MTG Leaderboard to homeserver

echo "🚀 Deploying MTG Leaderboard to homeserver..."
ssh homeserver "mtg-update"
echo "✅ Deployment complete!"
