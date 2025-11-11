"""Scryfall API integration service for MTG card data."""
import httpx
from typing import Optional
from functools import lru_cache


# Scryfall API base URL
SCRYFALL_API_BASE = "https://api.scryfall.com"


class ScryfallService:
    """Service for interacting with Scryfall API."""

    @staticmethod
    def _extract_card_data(card: dict) -> dict:
        """
        Extract image URIs and other data from a card, handling both
        single-faced and double-faced cards.

        Args:
            card: Scryfall card object

        Returns:
            Dictionary with image URIs, type line, and mana cost
        """
        # For double-faced cards, use the front face
        if "card_faces" in card and len(card["card_faces"]) > 0:
            front_face = card["card_faces"][0]
            image_uris = front_face.get("image_uris", {})
            type_line = front_face.get("type_line", card.get("type_line", ""))
            mana_cost = front_face.get("mana_cost", card.get("mana_cost", ""))
        else:
            # Single-faced card
            image_uris = card.get("image_uris", {})
            type_line = card.get("type_line", "")
            mana_cost = card.get("mana_cost", "")

        return {
            "image_small": image_uris.get("small"),
            "image_normal": image_uris.get("normal"),
            "image_art_crop": image_uris.get("art_crop"),
            "type_line": type_line,
            "mana_cost": mana_cost,
        }

    @staticmethod
    async def search_commanders(query: str, limit: int = 20) -> list[dict]:
        """
        Search for legendary creatures that can be commanders.

        Args:
            query: Search query string
            limit: Maximum number of results to return

        Returns:
            List of commander cards with name, image URLs, and color identity
        """
        if not query or len(query) < 2:
            return []

        async with httpx.AsyncClient() as client:
            # Search for legendary creatures using Scryfall's search syntax
            search_query = f'(t:legendary t:creature) name:"{query}"'
            params = {
                "q": search_query,
                "unique": "cards",
                "order": "name",
            }

            response = await client.get(
                f"{SCRYFALL_API_BASE}/cards/search",
                params=params,
                timeout=10.0
            )

            if response.status_code != 200:
                return []

            data = response.json()
            cards = data.get("data", [])[:limit]

            # Format response for frontend
            results = []
            for card in cards:
                card_data = ScryfallService._extract_card_data(card)

                # Skip cards without any images
                if not card_data["image_small"]:
                    continue

                results.append({
                    "name": card["name"],
                    "image_small": card_data["image_small"],
                    "image_normal": card_data["image_normal"],
                    "image_art_crop": card_data["image_art_crop"],
                    "color_identity": card.get("color_identity", []),
                    "type_line": card_data["type_line"],
                    "mana_cost": card_data["mana_cost"],
                })

            return results

    @staticmethod
    async def get_commander_details(name: str) -> Optional[dict]:
        """
        Get full details for a specific commander by exact name.

        Args:
            name: Exact card name

        Returns:
            Card details including images and color identity, or None if not found
        """
        async with httpx.AsyncClient() as client:
            params = {"exact": name}

            response = await client.get(
                f"{SCRYFALL_API_BASE}/cards/named",
                params=params,
                timeout=10.0
            )

            if response.status_code != 200:
                return None

            card = response.json()

            # Extract card data (handles both single and double-faced cards)
            card_data = ScryfallService._extract_card_data(card)

            # Verify it's a legendary creature
            # For DFCs, check the front face type line
            type_line = card_data["type_line"].lower()
            if "legendary" not in type_line or "creature" not in type_line:
                return None

            # Get oracle text (for DFCs, use the front face)
            oracle_text = ""
            if "card_faces" in card and len(card["card_faces"]) > 0:
                oracle_text = card["card_faces"][0].get("oracle_text", "")
            else:
                oracle_text = card.get("oracle_text", "")

            return {
                "name": card["name"],
                "image_small": card_data["image_small"],
                "image_normal": card_data["image_normal"],
                "image_art_crop": card_data["image_art_crop"],
                "color_identity": card.get("color_identity", []),
                "type_line": card_data["type_line"],
                "mana_cost": card_data["mana_cost"],
                "oracle_text": oracle_text,
            }

    @staticmethod
    @lru_cache(maxsize=100)
    def get_cached_commander_sync(name: str) -> Optional[dict]:
        """
        Cached synchronous wrapper for commander lookup.
        Used for quick lookups with caching.
        """
        # This would need to be implemented with async cache in production
        # For now, this is a placeholder for the caching strategy
        pass


scryfall_service = ScryfallService()
