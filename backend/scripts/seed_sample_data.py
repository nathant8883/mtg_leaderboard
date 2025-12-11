#!/usr/bin/env python3
"""
Seed script to populate the local MongoDB with sample data for development/testing.

Usage:
    cd backend
    uv run python scripts/seed_sample_data.py

This script will:
1. Create a sample pod "Test Pod"
2. Create 5 sample players with various decks
3. Create 20+ sample matches with varied outcomes
"""

import asyncio
import random
from datetime import datetime, date, timedelta
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

# MongoDB connection
MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "mtg_leaderboard"

# Sample commanders with their colors and image URLs
SAMPLE_COMMANDERS = [
    # Mono colors
    {"name": "Heliod, Sun-Crowned", "colors": ["W"], "image": "https://cards.scryfall.io/art_crop/front/e/9/e90d01c9-e76e-42ff-b0fa-8b6c88571bc0.jpg"},
    {"name": "Urza, Lord High Artificer", "colors": ["U"], "image": "https://cards.scryfall.io/art_crop/front/9/e/9e7fb3c0-5159-4d1f-8490-ce4c9a60f567.jpg"},
    {"name": "K'rrik, Son of Yawgmoth", "colors": ["B"], "image": "https://cards.scryfall.io/art_crop/front/3/5/3592fbe4-8588-486e-99ba-c327b0b6ba24.jpg"},
    {"name": "Krenko, Mob Boss", "colors": ["R"], "image": "https://cards.scryfall.io/art_crop/front/c/d/cd9fec9d-23c8-4d35-97c1-9499527198fb.jpg"},
    {"name": "Yeva, Nature's Herald", "colors": ["G"], "image": "https://cards.scryfall.io/art_crop/front/2/2/22ecead7-58b3-4e34-8f7d-b095abee7f24.jpg"},
    # Two colors
    {"name": "Azorius Senate (Grand Arbiter)", "colors": ["W", "U"], "image": "https://cards.scryfall.io/art_crop/front/e/6/e6784910-0204-4a39-bb38-50daa03e94c2.jpg"},
    {"name": "Teysa Karlov", "colors": ["W", "B"], "image": "https://cards.scryfall.io/art_crop/front/b/c/bcfaa19e-995e-447d-a0a2-46e5d117d5ec.jpg"},
    {"name": "Winota, Joiner of Forces", "colors": ["W", "R"], "image": "https://cards.scryfall.io/art_crop/front/5/d/5dd13a6c-23d3-44ce-a628-cb1c19d777c4.jpg"},
    {"name": "Rhys the Redeemed", "colors": ["W", "G"], "image": "https://cards.scryfall.io/art_crop/front/b/9/b91dadcb-31e9-43b0-b425-c9311af3e9d7.jpg"},
    {"name": "Yuriko, the Tiger's Shadow", "colors": ["U", "B"], "image": "https://cards.scryfall.io/art_crop/front/3/b/3bd81ae6-e628-447a-a36b-597e63ede295.jpg"},
    {"name": "Niv-Mizzet, Parun", "colors": ["U", "R"], "image": "https://cards.scryfall.io/art_crop/front/5/6/56a2609d-b535-400b-81d9-72989a33c70f.jpg"},
    {"name": "Tatyova, Benthic Druid", "colors": ["U", "G"], "image": "https://cards.scryfall.io/art_crop/front/9/3/93657aaa-7a0f-49ad-b026-6f79b3bd6768.jpg"},
    {"name": "Rakdos, Lord of Riots", "colors": ["B", "R"], "image": "https://cards.scryfall.io/art_crop/front/0/4/04f3db71-802f-488c-b40d-ac90df2d660a.jpg"},
    {"name": "Meren of Clan Nel Toth", "colors": ["B", "G"], "image": "https://cards.scryfall.io/art_crop/front/1/7/17d6703c-ad79-457b-a1b5-c2284e363085.jpg"},
    {"name": "Xenagos, God of Revels", "colors": ["R", "G"], "image": "https://cards.scryfall.io/art_crop/front/3/1/3184b138-1109-4195-9d96-4f190164e98b.jpg"},
    # Three colors
    {"name": "Zur the Enchanter", "colors": ["W", "U", "B"], "image": "https://cards.scryfall.io/art_crop/front/a/e/aeb0160a-dfdc-4b1f-865e-ef905aee65d5.jpg"},
    {"name": "Narset, Enlightened Master", "colors": ["W", "U", "R"], "image": "https://cards.scryfall.io/art_crop/front/f/2/f210adb7-b389-4672-a3eb-0ced9bfe190c.jpg"},
    {"name": "Ghave, Guru of Spores", "colors": ["W", "B", "G"], "image": "https://cards.scryfall.io/art_crop/front/1/1/11590bf6-184e-4134-b1f6-7b8de5a23564.jpg"},
    {"name": "Marath, Will of the Wild", "colors": ["W", "R", "G"], "image": "https://cards.scryfall.io/art_crop/front/5/7/57afa796-db46-45ff-91bd-f02922e5f33d.jpg"},
    {"name": "The Mimeoplasm", "colors": ["U", "B", "G"], "image": "https://cards.scryfall.io/art_crop/front/a/e/aedc7a6b-c481-4719-bc83-424e7f7b4c97.jpg"},
    {"name": "Kess, Dissident Mage", "colors": ["U", "B", "R"], "image": "https://cards.scryfall.io/art_crop/front/e/8/e83e6d7a-3af0-4955-8bc1-b4f1edf67e34.jpg"},
    {"name": "Omnath, Locus of the Roil", "colors": ["U", "R", "G"], "image": "https://cards.scryfall.io/art_crop/front/c/b/cb53a29d-2de2-4f79-a423-e9f4631e3d65.jpg"},
    {"name": "Korvold, Fae-Cursed King", "colors": ["B", "R", "G"], "image": "https://cards.scryfall.io/art_crop/front/9/2/92ea1575-eb64-43b5-b604-c6e23054f228.jpg"},
    # Four colors
    {"name": "Atraxa, Praetors' Voice", "colors": ["W", "U", "B", "G"], "image": "https://cards.scryfall.io/art_crop/front/d/0/d0d33d52-3d28-4635-b985-51e126289259.jpg"},
    {"name": "Breya, Etherium Shaper", "colors": ["W", "U", "B", "R"], "image": "https://cards.scryfall.io/art_crop/front/2/1/2143f700-7311-46a4-ad9b-4e743a345e45.jpg"},
    {"name": "Yidris, Maelstrom Wielder", "colors": ["U", "B", "R", "G"], "image": "https://cards.scryfall.io/art_crop/front/c/2/c219dd22-433c-4f6a-a0c4-fae12239291c.jpg"},
    # Five colors
    {"name": "Kenrith, the Returned King", "colors": ["W", "U", "B", "R", "G"], "image": "https://cards.scryfall.io/art_crop/front/5/6/56c1227e-bea7-47cb-bbec-389a3d585af5.jpg"},
    {"name": "The First Sliver", "colors": ["W", "U", "B", "R", "G"], "image": "https://cards.scryfall.io/art_crop/front/0/6/06d4fbe1-8a2f-4571-a6c0-c39a04f0e276.jpg"},
    # Colorless
    {"name": "Kozilek, the Great Distortion", "colors": [], "image": "https://cards.scryfall.io/art_crop/front/f/0/f06fc6e0-b22c-40d3-bb53-d5ec400d921c.jpg"},
]

# Sample player data
SAMPLE_PLAYERS = [
    {"name": "Alice", "avatar": "A", "email": "alice@test.local"},
    {"name": "Bob", "avatar": "B", "email": "bob@test.local"},
    {"name": "Charlie", "avatar": "C", "email": "charlie@test.local"},
    {"name": "Diana", "avatar": "D", "email": "diana@test.local"},
    {"name": "Eve", "avatar": "E", "email": "eve@test.local"},
]


async def clear_collections(db):
    """Clear existing data from collections"""
    print("Clearing existing data...")
    await db.players.delete_many({})
    await db.decks.delete_many({})
    await db.matches.delete_many({})
    await db.pods.delete_many({})
    await db.pod_invites.delete_many({})
    await db.player_elo_ratings.delete_many({})
    await db.elo_history.delete_many({})
    print("Collections cleared.")


async def create_pod(db, creator_id: str, member_ids: list[str]) -> str:
    """Create a sample pod"""
    pod = {
        "_id": ObjectId(),
        "name": "Test Pod",
        "description": "A sample pod for testing and development",
        "creator_id": creator_id,
        "admin_ids": [creator_id],
        "member_ids": member_ids,
        "custom_image": None,
        "created_at": datetime.utcnow(),
    }
    await db.pods.insert_one(pod)
    print(f"Created pod: {pod['name']} (ID: {pod['_id']})")
    return str(pod["_id"])


async def create_players(db, pod_id: str) -> list[dict]:
    """Create sample players"""
    players = []
    for player_data in SAMPLE_PLAYERS:
        player = {
            "_id": ObjectId(),
            "name": player_data["name"],
            "avatar": player_data["avatar"],
            "deck_ids": [],
            "email": player_data["email"],
            "google_id": None,
            "picture": f"https://api.dicebear.com/7.x/avataaars/svg?seed={player_data['name']}",
            "custom_avatar": None,
            "is_superuser": player_data["name"] == "Alice",  # Make Alice a superuser
            "is_guest": False,
            "pod_ids": [pod_id],
            "current_pod_id": pod_id,
            "created_at": datetime.utcnow(),
        }
        await db.players.insert_one(player)
        players.append(player)
        print(f"Created player: {player['name']} (ID: {player['_id']})")
    return players


async def create_decks(db, players: list[dict]) -> list[dict]:
    """Create sample decks for each player (2-4 decks per player)"""
    decks = []
    available_commanders = SAMPLE_COMMANDERS.copy()
    random.shuffle(available_commanders)

    for player in players:
        num_decks = random.randint(2, 4)
        player_deck_ids = []

        for _ in range(num_decks):
            if not available_commanders:
                available_commanders = SAMPLE_COMMANDERS.copy()
                random.shuffle(available_commanders)

            commander = available_commanders.pop()
            deck = {
                "_id": ObjectId(),
                "name": f"{player['name']}'s {commander['name'].split(',')[0]}",
                "player_id": str(player["_id"]),
                "commander": commander["name"],
                "commander_image_url": commander["image"],
                "colors": commander["colors"],
                "disabled": False,
                "created_at": datetime.utcnow(),
            }
            await db.decks.insert_one(deck)
            decks.append(deck)
            player_deck_ids.append(str(deck["_id"]))
            print(f"  Created deck: {deck['name']} ({'/'.join(deck['colors']) or 'C'})")

        # Update player with deck IDs
        await db.players.update_one(
            {"_id": player["_id"]},
            {"$set": {"deck_ids": player_deck_ids}}
        )

    return decks


async def create_matches(db, players: list[dict], decks: list[dict], pod_id: str, num_matches: int = 25):
    """Create sample matches"""
    print(f"\nCreating {num_matches} sample matches...")

    # Build a lookup of player_id -> their decks
    player_decks = {}
    for player in players:
        player_decks[str(player["_id"])] = [d for d in decks if d["player_id"] == str(player["_id"])]

    matches_created = 0
    base_date = date.today() - timedelta(days=60)

    for i in range(num_matches):
        # Pick 3-5 random players for this match
        num_players = random.randint(3, min(5, len(players)))
        match_players = random.sample(players, num_players)

        # Build match player list with deck selection
        match_player_list = []
        for idx, player in enumerate(match_players):
            player_deck_list = player_decks[str(player["_id"])]
            if not player_deck_list:
                continue

            deck = random.choice(player_deck_list)
            match_player_list.append({
                "player_id": str(player["_id"]),
                "player_name": player["name"],
                "deck_id": str(deck["_id"]),
                "deck_name": deck["name"],
                "deck_colors": deck["colors"],
                "elimination_order": None,  # Will set for winner
                "is_winner": False,
            })

        if len(match_player_list) < 3:
            continue

        # Pick a winner (weighted towards some players for variety)
        winner_weights = [1.5 if p["player_name"] == "Alice" else 1.2 if p["player_name"] == "Bob" else 1.0
                        for p in match_player_list]
        winner_idx = random.choices(range(len(match_player_list)), weights=winner_weights, k=1)[0]

        # Set winner
        match_player_list[winner_idx]["is_winner"] = True
        match_player_list[winner_idx]["elimination_order"] = 1

        # Optionally set elimination order for others (50% of matches have full elimination order)
        if random.random() > 0.5:
            non_winners = [i for i in range(len(match_player_list)) if i != winner_idx]
            random.shuffle(non_winners)
            for order, idx in enumerate(non_winners, start=2):
                match_player_list[idx]["elimination_order"] = order

        # Create match
        match_date = base_date + timedelta(days=random.randint(0, 60))
        match = {
            "_id": ObjectId(),
            "players": match_player_list,
            "winner_player_id": match_player_list[winner_idx]["player_id"],
            "winner_deck_id": match_player_list[winner_idx]["deck_id"],
            "pod_id": pod_id,
            "match_date": match_date.isoformat(),
            "duration_seconds": random.randint(1800, 7200) if random.random() > 0.3 else None,
            "first_player_position": random.randint(0, len(match_player_list) - 1) if random.random() > 0.5 else None,
            "created_at": datetime.combine(match_date, datetime.min.time()),
        }

        await db.matches.insert_one(match)
        matches_created += 1
        winner_name = match_player_list[winner_idx]["player_name"]
        print(f"  Match {matches_created}: {len(match_player_list)} players, winner: {winner_name}")

    print(f"Created {matches_created} matches.")


async def main():
    print("=" * 60)
    print("MTG Leaderboard Sample Data Seeder")
    print("=" * 60)

    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]

    try:
        # Clear existing data
        await clear_collections(db)

        # Create players first (need IDs for pod)
        print("\nCreating players...")
        players = await create_players(db, "temp")

        # Create pod with all player IDs
        print("\nCreating pod...")
        player_ids = [str(p["_id"]) for p in players]
        pod_id = await create_pod(db, player_ids[0], player_ids)

        # Update players with real pod_id
        await db.players.update_many(
            {},
            {"$set": {"pod_ids": [pod_id], "current_pod_id": pod_id}}
        )

        # Create decks
        print("\nCreating decks...")
        decks = await create_decks(db, players)

        # Create matches
        await create_matches(db, players, decks, pod_id)

        # Add Dev User to the pod (created on first dev login)
        print("\nConfiguring Dev User...")
        dev_user = await db.players.find_one({"email": "dev@test.local"})
        if dev_user:
            await db.players.update_one(
                {"_id": dev_user["_id"]},
                {"$set": {"pod_ids": [pod_id], "current_pod_id": pod_id, "is_superuser": True}}
            )
            await db.pods.update_one(
                {"_id": ObjectId(pod_id)},
                {"$addToSet": {"member_ids": str(dev_user["_id"])}}
            )
            print(f"  Dev User added to Test Pod and made superuser")
        else:
            print(f"  Dev User not found (will be added on first dev login)")
            print(f"  Run this script again after logging in once to add Dev User to pod")

        print("\n" + "=" * 60)
        print("Sample data seeding complete!")
        print("=" * 60)
        print(f"\nCreated:")
        print(f"  - 1 pod")
        print(f"  - {len(players)} players")
        print(f"  - {len(decks)} decks")
        print(f"  - 25 matches")
        print(f"\nYou can log in as any player using dev login.")
        print(f"Alice and Dev User are superusers and can access the admin panel.")

    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
