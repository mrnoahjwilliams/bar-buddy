#!/usr/bin/env python3
"""Capture the current IBA cocktail list as a machine-readable source snapshot."""

from __future__ import annotations

import argparse
import html as html_module
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path


LIST_URL = "https://iba-world.com/cocktails/all-cocktails/"
COCKTAIL_URL_PREFIX = "https://iba-world.com/iba-cocktail/"
EXPECTED_COCKTAIL_COUNT = 102
USER_AGENT = "BarBuddyCatalogBot/0.1 (offline catalog curation)"


def fetch(url: str, attempts: int = 3) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read().decode("utf-8")
        except (TimeoutError, urllib.error.URLError):
            if attempt == attempts - 1:
                raise
            time.sleep(2**attempt)
    raise AssertionError("unreachable")


def text_content(fragment: str) -> str:
    fragment = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.IGNORECASE)
    fragment = re.sub(r"</p\s*>", "\n", fragment, flags=re.IGNORECASE)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    fragment = html_module.unescape(fragment).replace("\xa0", " ")
    lines = [re.sub(r"\s+", " ", line).strip() for line in fragment.splitlines()]
    return "\n".join(line for line in lines if line)


def find_cocktail_urls() -> list[str]:
    slugs: set[str] = set()
    page = 1
    while True:
        url = LIST_URL if page == 1 else f"{LIST_URL}page/{page}/"
        try:
            page_html = fetch(url)
        except urllib.error.HTTPError as error:
            if error.code == 404 and page > 1:
                break
            raise
        page_slugs = set(
            re.findall(
                r"https://iba-world\.com/iba-cocktail/([^/\"?#]+)/?",
                page_html,
            )
        )
        if not page_slugs:
            break
        before = len(slugs)
        slugs.update(page_slugs)
        if len(slugs) == before:
            break
        page += 1

    if len(slugs) != EXPECTED_COCKTAIL_COUNT:
        raise ValueError(
            f"Expected {EXPECTED_COCKTAIL_COUNT} cocktails, found {len(slugs)}. "
            "Review the official list and scraper before accepting the snapshot."
        )
    return [f"{COCKTAIL_URL_PREFIX}{slug}/" for slug in sorted(slugs)]


def extract_shortcode_after_heading(page_html: str, heading: str) -> str:
    pattern = re.compile(
        rf">\s*{re.escape(heading)}\s*</h4>.*?"
        r'<div class="elementor-shortcode">(.*?)</div>',
        flags=re.IGNORECASE | re.DOTALL,
    )
    match = pattern.search(page_html)
    if not match:
        raise ValueError(f"Could not find {heading} section")
    return match.group(1)


def parse_cocktail(url: str) -> dict[str, object]:
    page_html = fetch(url)
    title_match = re.search(
        r'<h1 class="elementor-heading-title elementor-size-default">(.*?)</h1\s*>',
        page_html,
        flags=re.DOTALL,
    )
    category_match = re.search(
        r'<a[^>]+class="taxonomy cocktail-category"[^>]*>\s*'
        r'<span[^>]*>(.*?)</span>',
        page_html,
        flags=re.DOTALL,
    )
    if not title_match or not category_match:
        raise ValueError(f"Could not find title/category on {url}")

    ingredient_html = extract_shortcode_after_heading(page_html, "Ingredients")
    ingredient_lines = [
        text_content(item)
        for item in re.findall(r"<li[^>]*>(.*?)</li>", ingredient_html, flags=re.DOTALL)
    ]
    cocktail = {
        "slug": url.removeprefix(COCKTAIL_URL_PREFIX).strip("/"),
        "name": text_content(title_match.group(1)),
        "ibaCategory": text_content(category_match.group(1)),
        "ingredientLines": ingredient_lines,
        "method": text_content(extract_shortcode_after_heading(page_html, "Method")),
        "garnish": text_content(extract_shortcode_after_heading(page_html, "Garnish")),
        "sourceUrl": url,
    }
    missing = [key for key, value in cocktail.items() if not value]
    if missing:
        raise ValueError(f"Missing {', '.join(missing)} on {url}")
    return cocktail


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--retrieved-on", default=date.today().isoformat())
    args = parser.parse_args()

    urls = find_cocktail_urls()
    cocktails = []
    for index, url in enumerate(urls, start=1):
        print(f"[{index:03}/{len(urls)}] {url}", file=sys.stderr)
        cocktails.append(parse_cocktail(url))

    snapshot = {
        "source": {
            "name": "International Bartenders Association Official Cocktail List",
            "listUrl": LIST_URL,
            "retrievedOn": args.retrieved_on,
        },
        "cocktailCount": len(cocktails),
        "cocktails": cocktails,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
