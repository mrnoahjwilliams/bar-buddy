#!/usr/bin/env python3
"""Build the reviewed-shape Bar Buddy catalog from an IBA source snapshot."""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from dataclasses import dataclass, field
from fractions import Fraction
from pathlib import Path
from typing import Any


ML_PER_OUNCE = 29.5735
EXPECTED_COCKTAIL_COUNT = 102

# Add an entry here if an accepted ingredient label changes after its ID is established.
# The ID remains the same while the display name can be corrected independently.
INGREDIENT_ID_OVERRIDES: dict[str, str] = {}


INGREDIENT_ALIASES = {
    "100% agave tequila": "Tequila",
    "absinthe": "Absinthe",
    "aged rum": "Aged rum",
    "agave nectar": "Agave syrup",
    "allspice saint elizabeth": "Allspice dram",
    "amaro nonino": "Amaro Nonino",
    "amontillado sherry": "Sherry",
    "amaretto": "Amaretto",
    "amber jamaican rum": "Aged rum",
    "angostura": "Aromatic bitters",
    "angostura bitters": "Aromatic bitters",
    "aperol": "Aperol",
    "apricot brandy": "Apricot liqueur",
    "aromatic bitters": "Aromatic bitters",
    "benedictine": "Bénédictine",
    "bitter campari": "Campari",
    "black pepper": "Black pepper",
    "blackstrap rum": "Dark rum",
    "blended aged rum": "Aged rum",
    "blended scotch whisky": "Scotch whisky",
    "bourbon": "Bourbon",
    "bourbon or rye whiskey": "Bourbon",
    "bourbon whiskey": "Bourbon",
    "brandy": "Brandy",
    "brut champagne or prosecco": "Sparkling wine",
    "cachaca": "Cachaça",
    "cachaça": "Cachaça",
    "calvados": "Calvados",
    "campari": "Campari",
    "celery salt": "Celery salt",
    "chamomile cordial": "Chamomile cordial",
    "champagne": "Sparkling wine",
    "champagne to serve on the side": "Sparkling wine",
    "cherry brandy luxardo": "Cherry liqueur",
    "cherry sangue morlacco": "Cherry liqueur",
    "coconut cream": "Coconut cream",
    "cloves": "Cloves",
    "coffee liqueur": "Coffee liqueur",
    "coffee": "Coffee",
    "cola": "Cola",
    "cointreau": "Orange liqueur",
    "cognac": "Cognac",
    "cognac or brandy": "Cognac",
    "cream": "Cream",
    "creme de cassis": "Crème de cassis",
    "cranberry juice": "Cranberry juice",
    "creme de cacao (brown)": "Crème de cacao",
    "creme de cacao (white)": "Crème de cacao",
    "creme de menthe (green)": "Crème de menthe",
    "creme de mure": "Crème de mûre",
    "creme de violette": "Crème de violette",
    "cuban aguardiente": "Aguardiente",
    "cuban rum": "White rum",
    "curacao": "Orange liqueur",
    "cynar": "Cynar",
    "demerara rum": "Dark rum",
    "demerara sugar syrup": "Simple syrup",
    "dom benedictine": "Bénédictine",
    "donn's mix": "Donn’s mix",
    "drambuie": "Drambuie",
    "dry gin": "Gin",
    "dry vermouth": "Dry vermouth",
    "dry white wine": "Dry white wine",
    "egg white": "Egg white",
    "egg yolk": "Egg yolk",
    "elderflower cordial": "Elderflower cordial",
    "espadin mezcal": "Mezcal",
    "espresso": "Espresso",
    "falernum": "Falernum",
    "fernet": "Fernet",
    "fernet branca": "Fernet",
    "gin": "Gin",
    "ginger": "Ginger",
    "ginger ale": "Ginger ale",
    "ginger beer": "Ginger beer",
    "gold jamaican rum": "Aged rum",
    "gold puerto rican rum": "Aged rum",
    "goslings rum": "Dark rum",
    "grand marnier": "Orange liqueur",
    "grapefruit juice": "Grapefruit juice",
    "green chartreuse": "Green Chartreuse",
    "grenadine syrup": "Grenadine",
    "honey mix": "Honey syrup",
    "honey mix (replace water with chamomile)": "Honey syrup",
    "honey syrup": "Honey syrup",
    "irish whiskey": "Irish whiskey",
    "islay scotch whisky": "Scotch whisky",
    "italian basil": "Basil",
    "jamaica overproof white rum": "Overproof white rum",
    "jamaican dark rum": "Dark rum",
    "jamaican rum": "Rum",
    "kahlua": "Coffee liqueur",
    "lagavulin 16y": "Scotch whisky",
    "lemon juice": "Lemon juice",
    "licor amaretto": "Amaretto",
    "licor frangelico": "Hazelnut liqueur",
    "lillet blanc": "Lillet Blanc",
    "lime": "Lime juice",
    "lime juice": "Lime juice",
    "london dry gin": "Gin",
    "maraschino luxardo": "Maraschino liqueur",
    "martinique molasses rhum": "Aged rum",
    "mezcal": "Mezcal",
    "mint": "Mint",
    "monin honey syrup": "Honey syrup",
    "orange": "Orange",
    "orange bitters": "Orange bitters",
    "orange curacao": "Orange liqueur",
    "orange flower water": "Orange flower water",
    "orange juice": "Orange juice",
    "old tom gin": "Old Tom gin",
    "orgeat syrup": "Orgeat syrup",
    "orgeat syrup (almond)": "Orgeat syrup",
    "overproof white rum": "Overproof white rum",
    "palo cortado": "Sherry",
    "passion fruit liqueur": "Passion fruit liqueur",
    "passion fruit puree": "Passion fruit purée",
    "passion fruit syrup": "Passion fruit syrup",
    "peach brandy": "Peach liqueur",
    "peach schnapps": "Peach liqueur",
    "pernod": "Pernod",
    "peychaud's bitters": "Peychaud’s bitters",
    "pineapple": "Pineapple",
    "pineapple juice": "Pineapple juice",
    "pink grapefruit soda": "Grapefruit soda",
    "pisco": "Pisco",
    "plain water": "Water",
    "powdered sugar": "Sugar",
    "prosecco": "Sparkling wine",
    "raspberry liqueur": "Raspberry liqueur",
    "raspberry syrup": "Raspberry syrup",
    "raw honey": "Honey",
    "red chili pepper": "Red chili pepper",
    "red tawny port wine": "Tawny port",
    "red wine (shiraz or malbech)": "Red wine",
    "rhum martinique agricole": "Rhum agricole",
    "ron profundo havana club": "Dark rum",
    "ron smoky havana club": "Dark rum",
    "rum": "Rum",
    "salt": "Salt",
    "rye whiskey": "Rye whiskey",
    "rye whiskey or bourbon": "Rye whiskey",
    "scotch whisky": "Scotch whisky",
    "simple syrup": "Simple syrup",
    "smirnoff vodka": "Vodka",
    "soda water": "Soda water",
    "sparkling wine": "Sparkling wine",
    "sugar": "Sugar",
    "sugar cane juice": "Sugar cane juice",
    "sugar syrup": "Simple syrup",
    "superfine sugar": "Sugar",
    "superfine sugar (or granulated)": "Sugar",
    "sweet red vermouth": "Sweet vermouth",
    "sweet vermouth": "Sweet vermouth",
    "sweet vermouth cinzano rosso": "Sweet vermouth",
    "tabasco sauce": "Tabasco sauce",
    "tequila": "Tequila",
    "tequila 100% agave": "Tequila",
    "tomato juice": "Tomato juice",
    "triple sec": "Orange liqueur",
    "vanilla extract": "Vanilla extract",
    "vanilla sugar": "Sugar",
    "vanilla vodka": "Vanilla vodka",
    "vodka": "Vodka",
    "vodka citron": "Citrus vodka",
    "vodka vanilla": "Vanilla vodka",
    "water": "Water",
    "white cane sugar": "Sugar",
    "white cream de menthe": "Crème de menthe",
    "white creme de menthe": "Crème de menthe",
    "white peach puree": "White peach purée",
    "white cuban ron": "White rum",
    "white rum": "White rum",
    "white smooth grappa": "Grappa",
    "worcestershire sauce": "Worcestershire sauce",
    "yellow chartreuse": "Yellow Chartreuse",
}


CATEGORY_BY_INGREDIENT = {
    # Spirits
    **{name: "spirit" for name in {
        "Absinthe", "Aged rum", "Aguardiente", "Bourbon", "Brandy", "Cachaça",
        "Calvados", "Cognac", "Dark rum", "Gin", "Grappa", "Irish whiskey",
        "Mezcal", "Old Tom gin", "Overproof white rum", "Pisco", "Rhum agricole",
        "Rum", "Rye whiskey", "Scotch whisky", "Tequila", "Vodka", "White rum",
        "Citrus vodka", "Vanilla vodka",
    }},
    # Liqueurs and aromatized alcoholic modifiers
    **{name: "liqueur" for name in {
        "Allspice dram", "Amaretto", "Amaro Nonino", "Aperol", "Apricot liqueur",
        "Bénédictine", "Campari", "Cherry liqueur", "Coffee liqueur", "Crème de cacao",
        "Crème de cassis", "Crème de menthe", "Crème de mûre",
        "Crème de violette", "Cynar", "Drambuie", "Falernum", "Fernet",
        "Green Chartreuse", "Hazelnut liqueur", "Maraschino liqueur", "Orange liqueur",
        "Passion fruit liqueur", "Peach liqueur", "Pernod", "Raspberry liqueur",
        "Yellow Chartreuse",
    }},
    **{name: "fortified_wine" for name in {
        "Dry vermouth", "Lillet Blanc", "Sherry", "Sweet vermouth", "Tawny port",
    }},
    **{name: "bitters" for name in {
        "Aromatic bitters", "Orange bitters", "Peychaud’s bitters",
    }},
    **{name: "syrup" for name in {
        "Agave syrup", "Chamomile cordial", "Donn’s mix", "Elderflower cordial",
        "Grenadine", "Honey", "Honey syrup", "Orgeat syrup", "Passion fruit syrup",
        "Raspberry syrup", "Simple syrup",
    }},
    **{name: "juice" for name in {
        "Cranberry juice", "Grapefruit juice", "Lemon juice", "Lime juice",
        "Orange juice", "Pineapple juice", "Sugar cane juice", "Tomato juice",
    }},
    **{name: "mixer" for name in {
        "Cola", "Dry white wine", "Ginger ale", "Ginger beer", "Grapefruit soda",
        "Red wine", "Soda water", "Sparkling wine",
    }},
    **{name: "fruit" for name in {
        "Lemon", "Lime", "Orange", "Passion fruit purée", "Pineapple", "Red chili pepper",
        "White peach purée",
    }},
    **{name: "herb" for name in {"Basil", "Ginger", "Mint"}},
    **{name: "other" for name in {
        "Black pepper", "Celery salt", "Cloves", "Coconut cream", "Coffee", "Cream", "Egg white",
        "Egg yolk", "Espresso", "Orange flower water", "Salt", "Sugar",
        "Tabasco sauce", "Vanilla extract", "Water", "Worcestershire sauce",
    }},
}


GLASSWARE = {
    "alexander": "cocktail glass", "americano": "rocks glass",
    "angel-face": "cocktail glass", "aviation": "cocktail glass",
    "bees-knees": "cocktail glass", "bellini": "flute",
    "between-the-sheets": "cocktail glass", "black-russian": "rocks glass",
    "bloody-mary": "rocks glass", "boulevardier": "cocktail glass",
    "bramble": "rocks glass", "brandy-crusta": "slim cocktail glass",
    "caipirinha": "double rocks glass", "canchanchara": "rocks glass",
    "cardinale": "cocktail glass", "casino": "rocks glass",
    "champagne-cocktail": "champagne glass", "chartreuse-swizzle": "tall glass",
    "clover-club": "cocktail glass", "corpse-reviver-2": "cocktail glass",
    "cosmopolitan": "large cocktail glass", "cuba-libre": "highball glass",
    "daiquiri": "cocktail glass", "dark-n-stormy": "highball glass",
    "dons-special-daiquiri": "footed copo glass", "dry-martini": "martini glass",
    "espresso-martini": "cocktail glass", "fernandito": "double rocks glass",
    "french-75": "flute", "french-connection": "rocks glass",
    "french-martini": "cocktail glass", "garibaldi": "highball glass",
    "gin-basil-smash": "cocktail glass", "gin-fizz": "tall tumbler",
    "grand-margarita": "rocks glass", "grasshopper": "cocktail glass",
    "hanky-panky": "cocktail glass", "hemingway-special": "large cocktail glass",
    "horses-neck": "highball glass", "iba-tiki": "tiki glass",
    "illegal": "cocktail glass", "irish-coffee": "Irish coffee glass",
    "john-collins": "highball glass", "jungle-bird": "rocks glass",
    "kir": "wine glass", "last-word": "cocktail glass",
    "lemon-drop-martini": "cocktail glass", "long-island-iced-tea": "highball glass",
    "mai-tai": "double rocks glass", "manhattan": "cocktail glass",
    "margarita": "cocktail glass", "martinez": "cocktail glass",
    "mary-pickford": "cocktail glass", "mimosa": "flute",
    "mint-julep": "julep cup", "missionarys-downfall": "large coupe",
    "mojito": "highball glass", "monkey-gland": "cocktail glass",
    "moscow-mule": "mule mug", "naked-and-famous": "cocktail glass",
    "negroni": "rocks glass", "new-york-sour": "rocks glass",
    "old-cuban": "cocktail glass", "old-fashioned": "rocks glass",
    "paloma": "highball glass", "paper-plane": "cocktail glass",
    "paradise": "cocktail glass", "penicillin": "rocks glass",
    "pina-colada": "large glass", "pisco-punch": "large goblet",
    "pisco-sour": "goblet", "planters-punch": "small tumbler",
    "porn-star-martini": "large cocktail glass", "porto-flip": "cocktail glass",
    "rabo-de-galo": "rocks glass", "ramos-fizz": "highball glass",
    "remember-the-maine": "coupe", "russian-spring-punch": "tall tumbler",
    "rusty-nail": "rocks glass", "sazerac": "rocks glass",
    "sea-breeze": "highball glass", "sex-on-the-beach": "highball glass",
    "sherry-cobbler": "julep cup", "sidecar": "cocktail glass",
    "singapore-sling": "hurricane glass", "south-side": "cocktail glass",
    "spicy-fifty": "cocktail glass", "spritz": "wine glass",
    "stinger": "martini glass", "suffering-bastard": "Collins glass",
    "tequila-sunrise": "highball glass", "three-dots-and-a-dash": "footed copo glass",
    "tipperary": "martini glass", "tommys-margarita": "rocks glass",
    "trinidad-sour": "cocktail glass", "tuxedo": "martini glass",
    "ve-n-to": "small tumbler", "vesper": "cocktail glass",
    "vieux-carre": "cocktail glass", "whiskey-sour": "cobbler glass",
    "white-lady": "cocktail glass", "zombie": "tall tumbler",
}


STYLE_VOCABULARY = {
    "old-fashioned", "martini", "manhattan", "negroni", "sour", "daisy",
    "collins", "fizz", "highball", "spritz", "julep", "smash", "swizzle",
    "cobbler", "flip", "punch", "duo-and-trio", "tiki",
}


# Every source cocktail is listed, including deliberately unclassified cocktails.
# Styles are optional and non-exclusive; an empty tuple is preferable to a forced fit.
STYLES_BY_COCKTAIL = {
    "alexander": ("duo-and-trio",),
    "americano": ("negroni", "highball"),
    "angel-face": ("duo-and-trio",),
    "aviation": ("sour", "daisy"),
    "bees-knees": ("sour",),
    "bellini": (),
    "between-the-sheets": ("sour", "daisy"),
    "black-russian": ("duo-and-trio",),
    "bloody-mary": (),
    "boulevardier": ("negroni",),
    "bramble": ("sour",),
    "brandy-crusta": ("sour", "daisy"),
    "caipirinha": ("sour",),
    "canchanchara": ("sour",),
    "cardinale": ("martini", "negroni"),
    "casino": ("sour", "daisy"),
    "champagne-cocktail": (),
    "chartreuse-swizzle": ("swizzle",),
    "clover-club": ("sour",),
    "corpse-reviver-2": ("sour", "daisy"),
    "cosmopolitan": ("sour", "daisy"),
    "cuba-libre": ("highball",),
    "daiquiri": ("sour",),
    "dark-n-stormy": ("highball",),
    "dons-special-daiquiri": ("sour", "tiki"),
    "dry-martini": ("martini",),
    "espresso-martini": (),
    "fernandito": ("highball",),
    "french-75": ("sour", "collins"),
    "french-connection": ("duo-and-trio",),
    "french-martini": (),
    "garibaldi": ("highball",),
    "gin-basil-smash": ("sour", "smash"),
    "gin-fizz": ("sour", "fizz"),
    "grand-margarita": ("sour", "daisy"),
    "grasshopper": ("duo-and-trio",),
    "hanky-panky": ("martini",),
    "hemingway-special": ("sour",),
    "horses-neck": ("highball",),
    "iba-tiki": ("tiki",),
    "illegal": ("sour",),
    "irish-coffee": (),
    "john-collins": ("sour", "collins"),
    "jungle-bird": ("sour", "tiki"),
    "kir": ("duo-and-trio",),
    "last-word": ("sour",),
    "lemon-drop-martini": ("sour", "daisy"),
    "long-island-iced-tea": ("highball",),
    "mai-tai": ("sour", "tiki"),
    "manhattan": ("manhattan",),
    "margarita": ("sour", "daisy"),
    "martinez": ("martini",),
    "mary-pickford": (),
    "mimosa": (),
    "mint-julep": ("julep",),
    "missionarys-downfall": ("sour", "tiki"),
    "mojito": ("sour", "collins"),
    "monkey-gland": (),
    "moscow-mule": ("highball",),
    "naked-and-famous": ("sour",),
    "negroni": ("negroni",),
    "new-york-sour": ("sour",),
    "old-cuban": ("sour", "collins"),
    "old-fashioned": ("old-fashioned",),
    "paloma": ("highball",),
    "paper-plane": ("sour",),
    "paradise": (),
    "penicillin": ("sour",),
    "pina-colada": ("tiki",),
    "pisco-punch": ("punch",),
    "pisco-sour": ("sour",),
    "planters-punch": ("punch", "tiki"),
    "porn-star-martini": (),
    "porto-flip": ("flip",),
    "rabo-de-galo": (),
    "ramos-fizz": ("sour", "fizz"),
    "remember-the-maine": ("manhattan",),
    "russian-spring-punch": ("sour", "punch"),
    "rusty-nail": ("duo-and-trio",),
    "sazerac": ("old-fashioned",),
    "sea-breeze": ("highball",),
    "sex-on-the-beach": ("highball",),
    "sherry-cobbler": ("cobbler",),
    "sidecar": ("sour", "daisy"),
    "singapore-sling": ("highball",),
    "south-side": ("sour",),
    "spicy-fifty": ("sour",),
    "spritz": ("spritz",),
    "stinger": ("duo-and-trio",),
    "suffering-bastard": ("highball",),
    "tequila-sunrise": ("highball",),
    "three-dots-and-a-dash": ("tiki",),
    "tipperary": ("manhattan",),
    "tommys-margarita": ("sour",),
    "trinidad-sour": ("sour",),
    "tuxedo": ("martini",),
    "ve-n-to": ("sour",),
    "vesper": ("martini",),
    "vieux-carre": ("manhattan",),
    "whiskey-sour": ("sour",),
    "white-lady": ("sour", "daisy"),
    "zombie": ("tiki",),
}


HEAVY_ONE_AND_HALF_50_ML = {
    ("bellini", 2),
    ("canchanchara", 4),
    ("irish-coffee", 3),
}


INSTRUCTION_OVERRIDES = {
    "bellini": (
        "Pour the peach purée into a mixing glass with ice, then add the Prosecco. "
        "Stir gently and pour into a chilled flute."
    ),
    "black-russian": "Pour the ingredients into a rocks glass filled with ice and stir gently.",
    "bloody-mary": (
        "Stir all ingredients gently in a mixing glass with ice, then pour into a rocks glass."
    ),
    "caipirinha": (
        "Place the lime and sugar in a double rocks glass and muddle gently. "
        "Fill the glass with cracked ice, add the cachaça, and stir gently."
    ),
    "gin-fizz": (
        "Shake all ingredients except the soda water with ice. Strain into a tall tumbler, "
        "top with soda water, and serve without ice."
    ),
    "john-collins": (
        "Pour all ingredients directly into an ice-filled highball glass and stir gently."
    ),
    "kir": "Pour the crème de cassis into a wine glass and top with the white wine.",
    "mimosa": "Pour the orange juice into a flute, gently add the Prosecco, and stir gently.",
    "pina-colada": (
        "Blend all ingredients with ice, pour into a large glass, and serve with a straw."
    ),
    "ramos-fizz": (
        "Pour all ingredients except the soda water into a cocktail shaker with ice. "
        "Shake for two minutes, double-strain, return the drink to the shaker, and shake "
        "hard without ice for one minute. Strain into a highball glass and top with soda water."
    ),
    "sazerac": (
        "Rinse a chilled rocks glass with the absinthe, add crushed ice, and set it aside. "
        "Stir the remaining ingredients over ice in a mixing glass. Discard the ice and "
        "excess absinthe from the prepared glass, then strain the drink into it."
    ),
    "spritz": "Build all ingredients in an ice-filled wine glass and stir gently.",
}


GARNISH_OVERRIDES = {
    "grasshopper": "Mint leaf (optional).",
}


GLASSWARE_NOTES = {
    "canchanchara": "The IBA method says only ‘glass’; selected a rocks glass for the initial recipe.",
    "kir": "The IBA method says only ‘glass’; selected a wine glass for the initial recipe.",
    "mojito": "The IBA method says only ‘glass’; selected a highball glass for the initial recipe.",
}


FIFTY_ML_RATIONALES = {
    ("bellini", 2): "Kept the peach purée below 2 oz so it remains a modifier to the Prosecco.",
    ("canchanchara", 4): "Kept the water below 2 oz to avoid over-diluting the drink.",
    ("irish-coffee", 3): "Kept the chilled cream below 2 oz because it forms the topping layer.",
}


ALTERNATIVE_CURATION_NOTES = {
    "45 ml Bourbon or Rye Whiskey": "Selected Bourbon as the initial recipe's first-listed alternative.",
    "60 ml Rye Whiskey or Bourbon": "Selected Rye whiskey as the initial recipe's first-listed alternative.",
    "60 ml Brut Champagne or Prosecco": "Matched both allowed alternatives to Sparkling wine.",
    "30 ml Cognac or Brandy": "Selected Cognac as the initial recipe's first-listed alternative.",
}


@dataclass
class ParsedLine:
    source_text: str
    ingredient_name: str
    source_quantity: float | None
    source_unit: str
    display_quantity: str
    quantity: float | None = None
    unit: str | None = None
    modifier: str | None = None
    optional: bool = False
    preparation: str | None = None
    curation_notes: list[str] = field(default_factory=list)
    maximum_quantity: float | None = None


def normalized_key(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = value.replace("’", "'").replace("*", "")
    value = re.sub(r"\s+", " ", value).strip().lower()
    return value


def canonicalize_ingredient(value: str) -> str:
    key = normalized_key(value)
    replacements = (
        ("freshly squeezed ", ""), ("fresh squeezed ", ""), ("fresh ", ""),
        ("chilled ", ""), ("hot ", ""), (" (chilled)", ""),
        (" leaves", ""), (" leaf", ""), (" sprigs", ""), (" sprig", ""),
        (" chunks", ""), (" chunk", ""), (" slice", ""),
    )
    for old, new in replacements:
        key = key.replace(old, new)
    key = re.sub(r"\s+", " ", key).strip()
    try:
        return INGREDIENT_ALIASES[key]
    except KeyError as error:
        raise ValueError(f"No canonical ingredient mapping for {value!r} (key {key!r})") from error


def recipe_display_name(corrected_text: str) -> str:
    """Retain the IBA's recipe-specific ingredient wording without its measurement."""
    value = unicodedata.normalize("NFC", corrected_text).strip()
    value = re.sub(r"\s*\(optional\)\.?", "", value, flags=re.IGNORECASE).strip()
    patterns = (
        r"^\d+(?:\.\d+)?\s*ml\s+",
        r"^\d+(?:/\d+)?\s+(?:bar\s+spoons?|teaspoons?|tsp|tablespoons?|dash(?:es)?|drops?|pcs?|slices?)\s+(?:of\s+)?",
        r"^\d+(?:\s+to\s+|[-/])\d+\s+(?:pcs\s+)?",
        r"^(?:a )?splash of ",
        r"^(?:a )?dash of ",
        r"^few (?:drops|dashes)(?: of)? ",
        r"^(?:fill up with|top with|top up with|top up) ",
        r"^a pinch of ",
        r"^\d+\s+fresh ",
        r"^\d+\s+thin slices ",
        r"^\d+\s+(?:raw whole |strong )?",
        r"^1/2\s+",
    )
    for pattern in patterns:
        updated = re.sub(pattern, "", value, count=1, flags=re.IGNORECASE)
        if updated != value:
            value = updated
            break
    value = re.sub(r"\s+to taste$", "", value, flags=re.IGNORECASE)
    value = value.replace("*", "").strip()
    overrides = {
        "Champagne to serve on the side": "Champagne",
        "Fresh cream (Chilled)": "Fresh cream",
        "Gengibre Slice": "Ginger",
        "Honey mix (replace water with chamomile)": "Honey mix",
        "Lime cut into small wedges": "Lime",
        "Mint sprigs": "Mint",
        "Mint Sprigs": "Mint",
        "Mint Leaves": "Mint",
        "Mint leaves": "Mint",
        "Italian Basil leaves": "Basil",
        "Pineapple Chunks": "Pineapple",
        "quarter size sliced fresh ginger": "Ginger",
        "Orange Wheel": "Orange",
        "Lemon Wheel": "Lemon",
        "Red Chili Pepper": "Red chili pepper",
        "Raw whole Egg White": "Egg white",
        "sugar cube": "Sugar",
        "Sugar Cube": "Sugar",
    }
    return overrides.get(value, value)


RECIPE_PREPARATION_OVERRIDES = {
    ("irish-coffee", 3): "chilled",
    ("porn-star-martini", 5): "serve on the side",
    ("ve-n-to", 3): "water may be replaced with chamomile infusion",
}


def corrected_lines(cocktail: dict[str, Any]) -> list[tuple[str, str, list[str]]]:
    result: list[tuple[str, str, list[str]]] = []
    for source_text in cocktail["ingredientLines"]:
        corrected = source_text
        notes: list[str] = []
        if cocktail["slug"] == "iba-tiki" and source_text in {
            "90 Fresh Pineapple Juice", "30 Fresh Lime Juice"
        }:
            corrected = source_text.replace(" Fresh", " ml Fresh", 1)
            notes.append("Added the omitted milliliter unit from the IBA source line.")
        elif cocktail["slug"] == "three-dots-and-a-dash" and source_text.startswith(
            "7.5 ml Allspice Saint Elizabeth15 ml"
        ):
            notes.append("Split two ingredients concatenated on the IBA source page.")
            result.append((source_text, "7.5 ml Allspice Saint Elizabeth", notes.copy()))
            result.append((source_text, "15 ml Fresh Lime Juice", notes.copy()))
            continue
        elif cocktail["slug"] == "bloody-mary" and source_text.startswith(
            "Tabasco, Celery Salt, Pepper"
        ):
            notes.append("Split the IBA source's combined to-taste seasonings into ingredient references.")
            for value in ("Tabasco Sauce to taste", "Celery Salt to taste", "Black Pepper to taste"):
                result.append((source_text, value, notes.copy()))
            continue
        if re.match(r"^\d+(?:\.\d+)?ml\b", corrected, re.IGNORECASE):
            corrected = re.sub(r"^(\d+(?:\.\d+)?)ml\b", r"\1 ml", corrected)
            notes.append("Added spacing around the milliliter unit from the IBA source line.")
        result.append((source_text, corrected, notes))
    return result


def number(value: str) -> float:
    return float(Fraction(value))


def display_number(value: float) -> str:
    quarters = round(value * 4)
    whole, remainder = divmod(quarters, 4)
    fraction = {0: "", 1: "¼", 2: "½", 3: "¾"}[remainder]
    return f"{whole} {fraction}".strip() if whole else fraction


def convert_ml(slug: str, position: int, milliliters: float) -> tuple[float, str | None, str, str]:
    if milliliters == 5:
        return 1, None, "1 barspoon", "barspoon"
    if milliliters == 10:
        return 0.25, "heavy", "heavy ¼ oz", "judgment"
    if milliliters == 20:
        return 0.75, "scant", "scant ¾ oz", "judgment"
    if milliliters == 50:
        if (slug, position) in HEAVY_ONE_AND_HALF_50_ML:
            return 1.5, "heavy", "heavy 1 ½ oz", "judgment"
        return 2, None, "2 oz", "judgment"
    ounces = round((milliliters / ML_PER_OUNCE) * 4) / 4
    return ounces, None, f"{display_number(ounces)} oz", "nearest-quarter-ounce"


def parse_line(
    slug: str,
    position: int,
    source_text: str,
    corrected_text: str,
    notes: list[str],
) -> ParsedLine:
    text = unicodedata.normalize("NFC", corrected_text).strip()
    optional = bool(re.search(r"\boptional\b", text, re.IGNORECASE))
    text = re.sub(r"\s*\(optional\)\.?", "", text, flags=re.IGNORECASE).strip()

    match = re.match(r"^(\d+(?:\.\d+)?)\s*ml\s+(.+)$", text, re.IGNORECASE)
    if match:
        milliliters = float(match.group(1))
        ingredient_text = match.group(2)
        quantity, modifier, display, conversion = convert_ml(slug, position, milliliters)
        unit = "barspoon" if conversion == "barspoon" else "ounce"
        conversion_notes: list[str] = []
        if conversion == "judgment":
            conversion_notes.append(
                f"Cocktail-specific presentation decision for {milliliters / ML_PER_OUNCE:.2f} "
                f"oz from {milliliters:g} ml."
            )
            if milliliters == 10:
                conversion_notes.append("Used a heavy ¼ oz to signal a pour larger than a standard ¼ oz.")
            elif milliliters == 20:
                conversion_notes.append("Used a scant ¾ oz to signal a pour smaller than a standard ¾ oz.")
            elif (slug, position) in FIFTY_ML_RATIONALES:
                conversion_notes.append(FIFTY_ML_RATIONALES[(slug, position)])
            else:
                conversion_notes.append("Used the familiar 2 oz bar measure for this ingredient.")
        return ParsedLine(
            source_text, canonicalize_ingredient(ingredient_text), milliliters,
            "milliliter", display, quantity, unit, modifier, optional,
            curation_notes=notes + conversion_notes,
        )

    range_match = re.match(r"^(\d+)(?:\s+to\s+|[-/])(\d+)\s+(?:pcs\s+)?(.+)$", text, re.IGNORECASE)
    if range_match and int(range_match.group(1)) > 1:
        low, high = int(range_match.group(1)), int(range_match.group(2))
        ingredient_text = range_match.group(3)
        preparation = None
        if re.match(r"^quarter size sliced fresh ", ingredient_text, flags=re.I):
            preparation = "quarter-size slices"
        ingredient_text = re.sub(r"^quarter size sliced fresh ", "", ingredient_text, flags=re.I)
        unit = "piece"
        if "mint" in ingredient_text.lower():
            unit = "leaf"
        unit_label = "leaves" if unit == "leaf" else "pieces"
        return ParsedLine(
            source_text, canonicalize_ingredient(ingredient_text), None, "range",
            f"{low}–{high} {unit_label}", float(low), unit, None, optional,
            preparation=preparation,
            curation_notes=notes + ["Interpreted the source slash/hyphen as a quantity range."],
            maximum_quantity=float(high),
        )

    unit_match = re.match(
        r"^(\d+(?:/\d+)?)\s+(bar\s+spoons?|teaspoons?|tsp|tablespoons?|dash(?:es)?|drops?|pcs?|slices?)\s+(?:of\s+)?(.+)$",
        text,
        re.IGNORECASE,
    )
    if unit_match:
        quantity = number(unit_match.group(1))
        source_unit = normalized_key(unit_match.group(2))
        unit = {
            "bar spoon": "barspoon", "bar spoons": "barspoon",
            "teaspoon": "teaspoon", "teaspoons": "teaspoon", "tsp": "teaspoon",
            "tablespoon": "tablespoon", "tablespoons": "tablespoon",
            "dash": "dash", "dashes": "dash", "drop": "drop", "drops": "drop",
            "pc": "piece", "pcs": "piece", "slice": "slice", "slices": "slice",
        }[source_unit]
        ingredient_text = unit_match.group(3)
        if normalized_key(ingredient_text) == "gengibre slice":
            ingredient_text = "Ginger"
            unit = "slice"
        elif "leaves" in ingredient_text.lower():
            unit = "leaf"
        elif "sprigs" in ingredient_text.lower():
            unit = "sprig"
        label = display_number(quantity)
        plural = quantity > 1
        unit_label = {
            "barspoon": "barspoons" if plural else "barspoon",
            "teaspoon": "teaspoons" if plural else "teaspoon",
            "tablespoon": "tablespoons" if plural else "tablespoon",
            "dash": "dashes" if plural else "dash",
            "drop": "drops" if plural else "drop",
            "piece": "pieces" if plural else "piece",
            "slice": "slices" if plural else "slice",
            "leaf": "leaves" if plural else "leaf",
            "sprig": "sprigs" if plural else "sprig",
        }[unit]
        return ParsedLine(
            source_text, canonicalize_ingredient(ingredient_text), quantity, unit,
            f"{label} {unit_label}", quantity, unit, None, optional,
            curation_notes=notes,
        )

    special_patterns = (
        (r"^(?:a )?splash of (.+)$", None, "splash", "a splash"),
        (r"^dash of (.+)$", 1, "dash", "1 dash"),
        (r"^a dash of (.+)$", 1, "dash", "1 dash"),
        (r"^few drops of (.+)$", None, "drop", "a few drops"),
        (r"^few drops (.+)$", None, "drop", "a few drops"),
        (r"^few dashes (.+)$", None, "dash", "a few dashes"),
        (r"^(?:fill up with|top with|top up with|top up) (.+)$", None, "top-up", "to top"),
        (r"^a pinch of (.+)$", 1, "pinch", "1 pinch"),
        (r"^(.+) to taste$", None, "to-taste", "to taste"),
    )
    for pattern, quantity, unit, display in special_patterns:
        match = re.match(pattern, text, re.IGNORECASE)
        if match:
            return ParsedLine(
                source_text, canonicalize_ingredient(match.group(1)), quantity, unit,
                display, quantity, unit, None, optional, curation_notes=notes,
            )

    if normalized_key(text) == "soda water":
        return ParsedLine(source_text, "Soda water", None, "top-up", "to top", None, "top-up", optional=optional, curation_notes=notes)
    if normalized_key(text) == "1 strong espresso":
        return ParsedLine(source_text, "Espresso", 1, "shot", "1 strong shot", 1, "shot", optional=optional, curation_notes=notes)
    if re.match(r"^1\s+(?:raw whole )?egg white$", text, re.IGNORECASE):
        return ParsedLine(source_text, "Egg white", 1, "piece", "1", 1, "piece", optional=optional, curation_notes=notes)
    if re.match(r"^1\s+sugar cube$", text, re.IGNORECASE):
        return ParsedLine(source_text, "Sugar", 1, "cube", "1 cube", 1, "cube", optional=optional, curation_notes=notes)
    match = re.match(r"^1\s+lime cut into small wedges$", text, re.IGNORECASE)
    if match:
        return ParsedLine(source_text, "Lime", 1, "piece", "1", 1, "piece", optional=optional, preparation="cut into small wedges", curation_notes=notes)
    match = re.match(r"^(\d+)\s+fresh mint sprigs$", text, re.IGNORECASE)
    if match:
        quantity = float(match.group(1))
        return ParsedLine(source_text, "Mint", quantity, "sprig", f"{int(quantity)} sprigs", quantity, "sprig", optional=optional, curation_notes=notes)
    match = re.match(r"^(1/2)\s+(orange|lemon) wheel$", text, re.IGNORECASE)
    if match:
        ingredient = "Orange" if match.group(2).lower() == "orange" else "Lemon"
        return ParsedLine(source_text, ingredient, 0.5, "wheel", "½ wheel", 0.5, "wheel", optional=optional, curation_notes=notes)
    match = re.match(r"^(\d+)\s+thin slices red chili pepper$", text, re.IGNORECASE)
    if match:
        quantity = float(match.group(1))
        return ParsedLine(source_text, "Red chili pepper", quantity, "slice", f"{int(quantity)} slices", quantity, "slice", optional=optional, curation_notes=notes)

    raise ValueError(f"Could not parse {slug} ingredient line: {source_text!r} -> {text!r}")


def ingredient_id(name: str) -> str:
    if name in INGREDIENT_ID_OVERRIDES:
        return INGREDIENT_ID_OVERRIDES[name]
    slug = normalized_key(name).replace("'", "")
    slug = re.sub(r"[^a-z0-9]+", "-", slug).strip("-")
    return f"ingredient:{slug}"


def json_number(value: float | None) -> float | int | None:
    if value is not None and value.is_integer():
        return int(value)
    return value


def measurement(
    quantity: float | None,
    maximum_quantity: float | None,
    unit: str,
    modifier: str | None,
) -> dict[str, Any]:
    return {
        "quantity": json_number(quantity),
        "maximumQuantity": json_number(maximum_quantity),
        "unit": unit,
        "modifier": modifier,
    }


def measurements(parsed: ParsedLine) -> dict[str, dict[str, Any]]:
    us = measurement(parsed.quantity, parsed.maximum_quantity, parsed.unit, parsed.modifier)
    if parsed.source_unit == "milliliter":
        metric = measurement(parsed.source_quantity, None, "milliliter", None)
    else:
        metric = us.copy()
    return {"us": us, "metric": metric}


def build_catalog(snapshot: dict[str, Any]) -> dict[str, Any]:
    if snapshot.get("cocktailCount") != EXPECTED_COCKTAIL_COUNT:
        raise ValueError(f"Expected {EXPECTED_COCKTAIL_COUNT} source cocktails")
    if set(GLASSWARE) != {cocktail["slug"] for cocktail in snapshot["cocktails"]}:
        raise ValueError("Glassware decisions do not exactly cover the source cocktails")
    if set(STYLES_BY_COCKTAIL) != {cocktail["slug"] for cocktail in snapshot["cocktails"]}:
        raise ValueError("Style decisions do not exactly cover the source cocktails")
    unknown_styles = {
        style
        for styles in STYLES_BY_COCKTAIL.values()
        for style in styles
        if style not in STYLE_VOCABULARY
    }
    if unknown_styles:
        raise ValueError(f"Unknown cocktail styles: {sorted(unknown_styles)}")

    cocktails = []
    ingredient_names: set[str] = set()
    for cocktail in snapshot["cocktails"]:
        recipe_ingredients = []
        cocktail_notes: list[str] = []
        primary_spirit: str | None = None
        if cocktail["slug"] in GLASSWARE_NOTES:
            cocktail_notes.append(GLASSWARE_NOTES[cocktail["slug"]])
        if cocktail["slug"] in INSTRUCTION_OVERRIDES:
            cocktail_notes.append(
                "Curated the IBA method by removing non-recipe notes and/or lightly editing the "
                "preparation wording; the raw wording remains in the source snapshot."
            )
        corrected = corrected_lines(cocktail)
        for position, (source_text, corrected_text, notes) in enumerate(corrected, start=1):
            parsed = parse_line(cocktail["slug"], position, source_text, corrected_text, notes)
            ingredient_names.add(parsed.ingredient_name)
            parsed_ingredient_id = ingredient_id(parsed.ingredient_name)
            if primary_spirit is None and CATEGORY_BY_INGREDIENT[parsed.ingredient_name] == "spirit":
                primary_spirit = parsed_ingredient_id
            if source_text in ALTERNATIVE_CURATION_NOTES:
                cocktail_notes.append(
                    f"{source_text}: {ALTERNATIVE_CURATION_NOTES[source_text]}"
                )
            line = {
                "position": position,
                "ingredientId": parsed_ingredient_id,
                "recipeDisplayName": recipe_display_name(corrected_text),
                "measurements": measurements(parsed),
                "requirement": "optional" if parsed.optional else "required",
                "preparation": RECIPE_PREPARATION_OVERRIDES.get(
                    (cocktail["slug"], position), parsed.preparation
                ),
            }
            recipe_ingredients.append(line)

        garnish = cocktail["garnish"].strip()
        if garnish.upper().rstrip(".") == "N/A":
            garnish = None
        else:
            garnish = GARNISH_OVERRIDES.get(cocktail["slug"], garnish)
        output_slug = "tiki" if cocktail["slug"] == "iba-tiki" else cocktail["slug"]
        output_name = "Tiki" if cocktail["slug"] == "iba-tiki" else cocktail["name"]
        cocktails.append({
            "id": f"cocktail:{output_slug}",
            "slug": output_slug,
            "name": output_name,
            "primarySpiritId": primary_spirit,
            "styles": list(STYLES_BY_COCKTAIL[cocktail["slug"]]),
            "recipes": [{
                "id": f"recipe:{output_slug}:default",
                "name": "Default recipe",
                "ingredients": recipe_ingredients,
                "instructions": INSTRUCTION_OVERRIDES.get(cocktail["slug"], cocktail["method"]),
                "glassware": GLASSWARE[cocktail["slug"]],
                "garnish": garnish,
            }],
        })

    missing_categories = ingredient_names - set(CATEGORY_BY_INGREDIENT)
    if missing_categories:
        raise ValueError(f"Missing categories for {sorted(missing_categories)}")
    ingredients = [
        {"id": ingredient_id(name), "name": name, "category": CATEGORY_BY_INGREDIENT[name]}
        for name in sorted(ingredient_names, key=str.casefold)
    ]
    return {
        "schemaVersion": 1,
        "catalog": {
            "id": "catalog:bar-buddy",
            "name": "Bar Buddy cocktail catalog",
            "defaultMeasurementSystem": "us",
        },
        "ingredients": ingredients,
        "cocktails": cocktails,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    snapshot = json.loads(args.source.read_text(encoding="utf-8"))
    catalog = build_catalog(snapshot)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
