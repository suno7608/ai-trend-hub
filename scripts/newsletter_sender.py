#!/usr/bin/env python3
"""Cron-friendly daily newsletter sender for AI Commerce Daily."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
TOOLS_DIR = ROOT / "tools"
DATA_DIR = ROOT / "data"
SUMMARIZED_PATH = DATA_DIR / "summarized.json"
STATE_PATH = DATA_DIR / "newsletter_state.json"
PREVIEW_PATH = DATA_DIR / "newsletter_preview_latest.html"
KST = ZoneInfo("Asia/Seoul")

if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from get_subscribers import get_subscribers  # noqa: E402
from send_newsletter import generate_html_newsletter, send_newsletter  # noqa: E402


def _load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as error:
        print(f"⚠️ Failed to load JSON ({path}): {error}")
        return default


def _save_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _emoji_for_categories(categories: list[str]) -> str:
    mapping = {
        "commerce": "🛒",
        "marketing": "📣",
        "tech": "🤖",
        "strategy": "🧭",
        "ai_commerce": "🛍️",
        "ai_marketing": "🎯",
        "ai_general": "🧠",
    }
    for category in categories:
        if category in mapping:
            return mapping[category]
    return "📰"


def _load_news_items(target_date: str, max_items: int) -> tuple[list[dict[str, str]], str]:
    raw_items = _load_json(SUMMARIZED_PATH, default=[])
    if not isinstance(raw_items, list) or not raw_items:
        raise RuntimeError(f"No usable data in {SUMMARIZED_PATH}")

    same_day = [item for item in raw_items if str(item.get("date_published", "")) == target_date]
    selected = same_day
    selected_date = target_date

    if not selected:
        available_dates = sorted(
            {
                str(item.get("date_published", ""))
                for item in raw_items
                if isinstance(item.get("date_published"), str) and item.get("date_published")
            }
        )
        if not available_dates:
            raise RuntimeError("No date_published in summarized.json")
        selected_date = available_dates[-1]
        selected = [
            item for item in raw_items if str(item.get("date_published", "")) == selected_date
        ]
        print(
            f"ℹ️ No items for {target_date}. Falling back to latest available date: {selected_date}"
        )

    seen_links: set[str] = set()
    newsletter_items: list[dict[str, str]] = []
    for item in selected:
        link = str(item.get("link", "")).strip()
        if not link or link in seen_links:
            continue
        seen_links.add(link)

        summary = str(item.get("summary_ko") or item.get("summary_en") or item.get("description") or "")
        summary = " ".join(summary.split())
        if len(summary) > 280:
            summary = summary[:277].rstrip() + "..."

        categories = item.get("categories") if isinstance(item.get("categories"), list) else []
        newsletter_items.append(
            {
                "emoji": _emoji_for_categories([str(c) for c in categories]),
                "title": str(item.get("title", "Untitled")),
                "source": str(item.get("source_name", "Unknown")),
                "published": str(item.get("date_published", selected_date)),
                "summary": summary,
                "url": link,
            }
        )

    newsletter_items.sort(key=lambda x: (x["source"], x["title"]))
    return newsletter_items[:max_items], selected_date


def _within_send_window(now_kst: datetime, target_hour: int, window_minutes: int) -> bool:
    return now_kst.hour == target_hour and 0 <= now_kst.minute < window_minutes


def _build_subject(date_str: str) -> str:
    return f"[AI Commerce Daily] {date_str} AI 커머스 & 마케팅 뉴스"


def main() -> int:
    parser = argparse.ArgumentParser(description="Send daily newsletter for AI Commerce Daily.")
    parser.add_argument("--date", default=None, help="Target date (YYYY-MM-DD). Default: today in KST.")
    parser.add_argument("--send", action="store_true", help="Actually send email via Gmail API.")
    parser.add_argument("--force", action="store_true", help="Skip 05:00 KST window check.")
    parser.add_argument(
        "--allow-resend",
        action="store_true",
        help="Allow sending even if this date is already marked as sent.",
    )
    parser.add_argument("--max-items", type=int, default=12, help="Max news items in newsletter.")
    parser.add_argument(
        "--window-minutes",
        type=int,
        default=15,
        help="Allowed minute window after 05:00 KST for scheduled sends.",
    )
    parser.add_argument(
        "--preview-path",
        default=str(PREVIEW_PATH),
        help="Path to save generated newsletter HTML.",
    )
    parser.add_argument(
        "--recipient",
        action="append",
        default=[],
        help="Extra recipient for testing (repeatable).",
    )
    args = parser.parse_args()

    now_kst = datetime.now(KST)
    target_date = args.date or now_kst.strftime("%Y-%m-%d")

    if not args.force and not _within_send_window(now_kst, target_hour=5, window_minutes=args.window_minutes):
        end_minute = max(args.window_minutes - 1, 0)
        print(
            f"⏭️ Skip: current KST time {now_kst.strftime('%Y-%m-%d %H:%M:%S')} "
            f"is outside send window (05:00-05:{end_minute:02d})."
        )
        return 0

    state = _load_json(STATE_PATH, default={})
    if not args.allow_resend and state.get("last_sent_date") == target_date:
        print(f"⏭️ Skip: newsletter already marked sent for {target_date}.")
        return 0

    try:
        subscribers = get_subscribers(verbose=True)
    except Exception as error:
        print(f"❌ Failed to fetch subscribers: {error}")
        return 1

    recipients = list(dict.fromkeys([*subscribers, *args.recipient]))
    if not recipients:
        print("⚠️ No recipients available. Check spreadsheet ID or pass --recipient for test.")
        return 1

    try:
        news_items, selected_date = _load_news_items(target_date=target_date, max_items=args.max_items)
    except Exception as error:
        print(f"❌ Failed to load newsletter news: {error}")
        return 1

    html = generate_html_newsletter(news_items, date_str=selected_date)
    preview_path = Path(args.preview_path)
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    preview_path.write_text(html, encoding="utf-8")
    print(f"📝 Preview saved: {preview_path}")

    subject = _build_subject(selected_date)
    success = send_newsletter(
        to_emails=recipients,
        subject=subject,
        html_content=html,
        dry_run=not args.send,
    )
    if not success:
        return 1

    mode = "send" if args.send else "dry-run"
    print(
        f"✅ Newsletter {mode} completed "
        f"(date={selected_date}, recipients={len(recipients)}, items={len(news_items)})."
    )

    if args.send:
        _save_json(
            STATE_PATH,
            {
                "last_sent_date": target_date,
                "last_sent_at_kst": now_kst.isoformat(),
                "last_recipient_count": len(recipients),
                "last_news_items": len(news_items),
            },
        )
        print(f"📌 Send state updated: {STATE_PATH}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
