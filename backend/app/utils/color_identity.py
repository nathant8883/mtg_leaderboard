"""
MTG Color Identity Name Mappings

Maps sorted color combinations to their common names in Magic: The Gathering.
"""

# Color identity names for combinations
COLOR_IDENTITY_NAMES = {
    # Mono-color
    ("B",): "Mono-Black",
    ("G",): "Mono-Green",
    ("R",): "Mono-Red",
    ("U",): "Mono-Blue",
    ("W",): "Mono-White",

    # Two-color (Guilds of Ravnica)
    ("U", "W"): "Azorius",
    ("B", "R"): "Rakdos",
    ("G", "R"): "Gruul",
    ("G", "W"): "Selesnya",
    ("U", "R"): "Izzet",
    ("B", "G"): "Golgari",
    ("B", "W"): "Orzhov",
    ("G", "U"): "Simic",
    ("R", "W"): "Boros",
    ("B", "U"): "Dimir",

    # Three-color (Shards)
    ("G", "U", "W"): "Bant",
    ("B", "U", "W"): "Esper",
    ("B", "R", "U"): "Grixis",
    ("B", "G", "R"): "Jund",
    ("G", "R", "W"): "Naya",

    # Three-color (Wedges)
    ("B", "G", "W"): "Abzan",
    ("R", "U", "W"): "Jeskai",
    ("B", "R", "W"): "Mardu",
    ("G", "R", "U"): "Temur",
    ("B", "G", "U"): "Sultai",

    # Four-color
    ("B", "G", "R", "W"): "Dune",  # Non-Blue (WBRG)
    ("G", "R", "U", "W"): "Glint",  # Non-Black (WURG)
    ("B", "G", "U", "W"): "Witch",  # Non-Red (WUBG)
    ("B", "R", "U", "W"): "Yore",   # Non-Green (WUBR)

    # Five-color
    ("B", "G", "R", "U", "W"): "WUBRG",
}


def get_color_identity_name(colors: list[str]) -> str:
    """
    Get the name of a color identity combination.

    Args:
        colors: List of color letters (e.g., ['W', 'U', 'B'])

    Returns:
        The common name for the color identity, or a default name if not found
    """
    if not colors:
        return "Colorless"

    # Sort colors alphabetically to match the key format
    sorted_colors = tuple(sorted(colors))

    # Look up the name
    return COLOR_IDENTITY_NAMES.get(sorted_colors, f"{len(colors)}-Color")
