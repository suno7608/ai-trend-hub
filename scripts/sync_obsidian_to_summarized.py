#!/usr/bin/env python3
"""Parse Obsidian AI Commerce News markdown → append to summarized.json for newsletter_sender."""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")
OBSIDIAN_DIR = Path("/Users/soonho/Obsidian_SoonHo/Daily Reports/AI Commerce News")
DATA_DIR = Path(__file__).resolve().parents[1] / "data"
SUMMARIZED_PATH = DATA_DIR / "summarized.json"


def parse_markdown_report(md_path: Path) -> list[dict]:
    """Parse an Obsidian AI Commerce News markdown file into summarized.json items."""
    text = md_path.read_text(encoding="utf-8")
    date_match = re.search(r"(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일", text)
    if date_match:
        date_str = f"{date_match.group(1)}-{int(date_match.group(2)):02d}-{int(date_match.group(3)):02d}"
    else:
        # fallback: filename
        date_str = md_path.stem

    items: list[dict] = []
    # Split by ### headers (individual news items)
    sections = re.split(r"^### \d+\.\s*", text, flags=re.MULTILINE)

    for section in sections[1:]:  # skip preamble
        lines = section.strip().split("\n")
        if not lines:
            continue

        # Title: first line (may have emoji prefix)
        title_line = lines[0].strip()
        # Remove leading emoji
        title = re.sub(r"^[^\w\s]*\s*", "", title_line).strip()

        # Extract URLs
        urls = re.findall(r"\[([^\]]+)\]\((https?://[^\)]+)\)", section)
        link = urls[0][1] if urls else ""
        source_name = urls[0][0] if urls else "Unknown"

        # Description: lines between title and URLs
        desc_lines = []
        for line in lines[1:]:
            line = line.strip()
            if line.startswith("- 📎") or line.startswith("📎") or not line:
                continue
            if line.startswith("---"):
                break
            desc_lines.append(line)
        description = " ".join(desc_lines).strip()
        if len(description) > 280:
            description = description[:277].rstrip() + "..."

        # Determine category
        category = "ai_commerce"
        section_lower = section.lower()
        if "마케팅" in section_lower or "marketing" in section_lower:
            category = "ai_marketing"
        elif "d2c" in section_lower or "이커머스" in section_lower:
            category = "commerce"

        items.append({
            "title": title,
            "link": link,
            "date_published": date_str,
            "description": description,
            "source_id": source_name.lower().replace(" ", "_"),
            "source_name": source_name,
            "source_url": link,
            "categories": [category],
            "summary_ko": description,
            "summary_en": "",
            "so_what_ko": "",
            "so_what_en": "",
            "key_points": [],
            "tags": [],
            "confidence": 0.9,
            "ai_processed": True,
        })

    return items


def sync(target_date: str | None = None) -> int:
    """Sync Obsidian report for target_date into summarized.json."""
    if target_date is None:
        target_date = datetime.now(KST).strftime("%Y-%m-%d")

    md_path = OBSIDIAN_DIR / f"{target_date}.md"
    if not md_path.exists():
        print(f"❌ Report not found: {md_path}")
        return 1

    new_items = parse_markdown_report(md_path)
    if not new_items:
        print(f"⚠️ No news items parsed from {md_path}")
        return 1

    # Load existing
    existing: list[dict] = []
    if SUMMARIZED_PATH.exists():
        try:
            existing = json.loads(SUMMARIZED_PATH.read_text(encoding="utf-8"))
        except Exception:
            existing = []

    # Remove old entries for same date
    existing = [item for item in existing if item.get("date_published") != target_date]

    # Append new
    merged = existing + new_items

    # Keep only last 30 days worth (avoid unbounded growth)
    all_dates = sorted(set(item.get("date_published", "") for item in merged))
    if len(all_dates) > 30:
        cutoff_date = all_dates[-30]
        merged = [item for item in merged if item.get("date_published", "") >= cutoff_date]

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SUMMARIZED_PATH.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"✅ Synced {len(new_items)} items for {target_date} → summarized.json (total: {len(merged)})")
    return 0


def main() -> int:
    target_date = sys.argv[1] if len(sys.argv) > 1 else None
    return sync(target_date)


if __name__ == "__main__":
    raise SystemExit(main())
