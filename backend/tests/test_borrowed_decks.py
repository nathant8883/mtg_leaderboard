"""Multiple players borrowing decks in the same match (needs a MongoDB).

Uses MTG_TEST_MONGO_URL (default mongodb://localhost:27099, the mtg-test-mongo
container) and a throwaway database; skipped if no MongoDB is reachable.
"""
import asyncio
import os
import uuid
from datetime import date

import pytest
from beanie import init_beanie
from pymongo import AsyncMongoClient

from app.models.match import Match
from app.models.player import Deck, Player
from app.models.pod import Pod
from app.routers.matches import CreateMatchRequest, UpdateMatchRequest, create_match, update_match

MONGO_URL = os.environ.get("MTG_TEST_MONGO_URL", "mongodb://localhost:27099")


async def make_player(name: str, deck_count: int) -> tuple[Player, list[Deck]]:
    player = await Player(name=name).insert()
    decks = [
        await Deck(name=f"{name} deck {i}", player_id=str(player.id), commander="X").insert()
        for i in range(deck_count)
    ]
    return player, decks


async def check_two_borrowers():
    alice, alice_decks = await make_player("Alice", 2)
    bob, _ = await make_player("Bob", 0)
    carol, carol_decks = await make_player("Carol", 1)
    dave, _ = await make_player("Dave", 0)

    pairs = [
        {"player_id": str(alice.id), "deck_id": str(alice_decks[0].id)},
        # Bob borrows from Alice (who is also playing)
        {"player_id": str(bob.id), "deck_id": str(alice_decks[1].id),
         "borrowed_from_player_id": str(alice.id)},
        # Dave borrows from Carol, who isn't in the game
        {"player_id": str(dave.id), "deck_id": str(carol_decks[0].id),
         "borrowed_from_player_id": str(carol.id)},
    ]
    result = await create_match(
        CreateMatchRequest(
            player_deck_pairs=pairs,
            winner_player_id=str(dave.id),
            winner_deck_id=str(carol_decks[0].id),
            match_date=date(2026, 10, 31),
        ),
        current_player=None,
    )

    expected = {str(alice.id): None, str(bob.id): "Alice", str(dave.id): "Carol"}
    borrows = {p["player_id"]: p["borrowed_from_player_name"] for p in result["players"]}
    assert borrows == expected

    # Editing the match (edit clients send no borrow info) keeps the borrows
    edit_pairs = [{"player_id": p["player_id"], "deck_id": p["deck_id"]} for p in pairs]
    updated = await update_match(
        (await Match.find_one()).id,
        UpdateMatchRequest(player_deck_pairs=edit_pairs),
    )
    borrows = {p["player_id"]: p["borrowed_from_player_name"] for p in updated["players"]}
    assert borrows == expected


async def run_with_test_db(check):
    client = AsyncMongoClient(MONGO_URL, serverSelectionTimeoutMS=1500)
    try:
        await client.admin.command("ping")
    except Exception:
        await client.close()
        return False
    name = f"test_borrow_{uuid.uuid4().hex[:8]}"
    try:
        await init_beanie(database=client[name], document_models=[Player, Deck, Match, Pod])
        await check()
    finally:
        await client.drop_database(name)
        await client.close()
    return True


def test_two_borrowers_in_one_match():
    if not asyncio.run(run_with_test_db(check_two_borrowers)):
        pytest.skip(f"MongoDB not reachable at {MONGO_URL}")
