#!/usr/bin/env python3
"""Cron-friendly daily newsletter sender for AI Commerce Daily.

Duplicate sends are detected from the article URLs that were actually emailed,
not from the wall-clock KST date. A delayed run that crosses midnight records
that date, but it must not block a later run whose articles were never sent.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from dataclasses import dataclass
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

# Gmail / Sheets imports stay inside main(). They pull in google-api libraries
# that are not needed to decide whether a run is a duplicate, and tests import
# the decision helpers without those packages installed.


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


def _load_archive_items() -> list[dict]:
    """Load all items from archive JSONL files."""
    archive_dir = DATA_DIR / "archive"
    items: list[dict] = []
    if not archive_dir.exists():
        return items
    for jsonl_file in sorted(archive_dir.glob("summarized_*.jsonl")):
        try:
            for line in jsonl_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line:
                    items.append(json.loads(line))
        except Exception as error:
            print(f"⚠️ Failed to load archive {jsonl_file}: {error}")
    return items


def _load_news_items(target_date: str, max_items: int, language: str = "ko") -> tuple[list[dict[str, str]], str]:
    from datetime import date, timedelta

    raw_items = _load_json(SUMMARIZED_PATH, default=[])

    # Merge archive data so recent dates are always available
    archive_items = _load_archive_items()
    if archive_items:
        existing_links = {item.get("link") for item in raw_items}
        for item in archive_items:
            if item.get("link") not in existing_links:
                raw_items.append(item)
                existing_links.add(item.get("link"))

    if not isinstance(raw_items, list) or not raw_items:
        raise RuntimeError(f"No usable data in {SUMMARIZED_PATH} or archive/")

    # ── Date selection strategy ───────────────────────────────────────────
    # RSS feeds often publish articles 1-3 days behind the actual collection
    # date. Using a strict "date_published == today" filter leaves most
    # freshly-collected articles unused. Instead we use a 3-day rolling window:
    # primary = last 3 days; fallback = last 7 days; last resort = latest date.
    # This ensures the newsletter always contains recently-collected content.
    try:
        target_dt = date.fromisoformat(target_date)
    except ValueError:
        target_dt = date.today()

    # Build a set of the 3 most recent calendar dates (today + 2 days back)
    window_3d = {str(target_dt - timedelta(days=i)) for i in range(3)}
    window_7d = {str(target_dt - timedelta(days=i)) for i in range(7)}

    in_3d = [item for item in raw_items if str(item.get("date_published", "")) in window_3d]
    selected_date = target_date

    if in_3d:
        selected = in_3d
        print(f"📅 Date filter: {len(selected)} items within 3-day window ({min(window_3d)}~{target_date})")
    else:
        # Expand to 7-day window
        in_7d = [item for item in raw_items if str(item.get("date_published", "")) in window_7d]
        if in_7d:
            # Use the latest date that has content within the 7-day window
            latest_in_window = max(
                str(item.get("date_published", "")) for item in in_7d
                if str(item.get("date_published", "")) in window_7d
            )
            selected_date = latest_in_window
            selected = [item for item in in_7d if str(item.get("date_published", "")) == selected_date]
            print(f"📅 Date filter: no 3-day items. Using 7-day window latest: {selected_date} ({len(selected)} items)")
        else:
            # Last resort: most recent available date in entire archive
            available_dates = sorted(
                {
                    str(item.get("date_published", ""))
                    for item in raw_items
                    if isinstance(item.get("date_published"), str) and item.get("date_published")
                }
            )
            if not available_dates:
                raise RuntimeError("No date_published in summarized.json or archive/")
            selected_date = available_dates[-1]
            selected = [item for item in raw_items if str(item.get("date_published", "")) == selected_date]
            print(f"⚠️ No items in 7-day window. Falling back to oldest available: {selected_date}")

    # ── Quality filter: relevance + confidence ────────────────────────────
    PRIORITY_CATEGORIES = {"ai_marketing", "ai_commerce", "agentic", "agentic_commerce"}
    MIN_RELEVANCE = 0.5
    MIN_CONFIDENCE = 0.6   # raised from implicit 0 — skip low-quality summaries

    before_count = len(selected)
    filtered = []
    for item in selected:
        rel_score = item.get("relevance_score")
        confidence = item.get("confidence", 1.0)  # default 1.0 for older items without score
        if rel_score is not None and float(rel_score) < MIN_RELEVANCE:
            continue
        if float(confidence) < MIN_CONFIDENCE:
            continue
        filtered.append(item)
    removed = before_count - len(filtered)
    if removed > 0:
        print(f"🎯 Quality filter: {removed} low-relevance/confidence items removed (of {before_count})")

    # Prioritize AI Marketing / Agentic Commerce items
    def _priority_key(item: dict) -> int:
        cats = set(item.get("categories", []))
        return 0 if cats & PRIORITY_CATEGORIES else 1

    filtered.sort(key=_priority_key)

    if language == "en":
        english_ready = []
        english_partial = []
        for item in filtered:
            has_title_en = bool(str(item.get("title_en") or "").strip())
            has_summary_en = bool(str(item.get("summary_en") or "").strip())
            if has_title_en and has_summary_en:
                english_ready.append(item)
            elif has_title_en or has_summary_en:
                english_partial.append(item)
        selected = english_ready + english_partial
        print(f"🌐 EN filter: {len(english_ready)} full EN items, {len(english_partial)} partial EN items")
    else:
        selected = filtered

    seen_links: set[str] = set()
    newsletter_items: list[dict[str, str]] = []
    for item in selected:
        link = str(item.get("link", "")).strip()
        if not link or link in seen_links:
            continue
        seen_links.add(link)

        preferred_summary = item.get("summary_en") if language == "en" else item.get("summary_ko")
        summary = str(
            preferred_summary
            or item.get("summary_en")
            or item.get("summary_ko")
            or item.get("description")
            or ""
        )
        summary = " ".join(summary.split())
        if len(summary) > 280:
            summary = summary[:277].rstrip() + "..."

        categories = item.get("categories") if isinstance(item.get("categories"), list) else []
        preferred_title = item.get("title_en") if language == "en" else item.get("title")
        title = str(
            preferred_title
            or item.get("title")
            or item.get("title_en")
            or "Untitled"
        )

        newsletter_items.append(
            {
                "emoji": _emoji_for_categories([str(c) for c in categories]),
                "title": title,
                "source": str(item.get("source_name", "Unknown")),
                "published": str(item.get("date_published", selected_date)),
                "summary": summary,
                "url": link,
                "categories": [str(c) for c in categories],
            }
        )

    # Sort by category order (ai_commerce → ai_marketing → commerce → others)
    cat_order = {"ai_commerce": 0, "ai_marketing": 1, "commerce": 2}
    newsletter_items.sort(key=lambda x: (cat_order.get((x.get("categories") or ["z"])[0], 9), x["title"]))
    return newsletter_items[:max_items], selected_date


def _within_send_window(now_kst: datetime, target_hour: int, window_minutes: int) -> bool:
    return now_kst.hour == target_hour and 0 <= now_kst.minute < window_minutes


def _build_subject(date_str: str, language: str = "ko") -> str:
    if language == "en":
        return f"[AI Trend Hub] {date_str} AI Commerce and Marketing Brief"
    return f"[AI Commerce Daily] {date_str} AI 커머스 & 마케팅 뉴스"


def article_urls(news_items: list[dict]) -> list[str]:
    """Unique article URLs in edition order. This is the dedup identity."""
    urls: list[str] = []
    seen: set[str] = set()
    for item in news_items:
        url = str(item.get("url") or item.get("link") or "").strip()
        if url and url not in seen:
            seen.add(url)
            urls.append(url)
    return urls


def content_fingerprint(urls: list[str]) -> str:
    payload = "\n".join(sorted(urls)).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()[:16]


def _history_entries(state: dict, language: str) -> list[dict]:
    raw = state.get(f"recently_sent_articles_{language}") or []
    if not isinstance(raw, list):
        return []
    return [entry for entry in raw if isinstance(entry, dict)]


def _sent_urls_for_language(state: dict, language: str) -> set[str]:
    urls: set[str] = set()
    for entry in _history_entries(state, language):
        for url in entry.get("urls") or []:
            if url:
                urls.add(str(url))
    return urls


def _content_dates_sent(state: dict) -> set[str]:
    raw = state.get("recently_sent_content_dates") or []
    if not isinstance(raw, list):
        return set()
    return {str(value) for value in raw if value}


@dataclass(frozen=True)
class NewsletterDecision:
    action: str  # "send" or "skip"
    reason: str
    message: str
    new_count: int
    total_count: int


def decide_newsletter_send(
    *,
    news_items: list[dict],
    state: dict,
    language: str,
    target_date: str,
    selected_date: str,
    allow_resend: bool,
) -> NewsletterDecision:
    """Decide whether this edition is a new send or a true duplicate.

    The wall-clock KST date is intentionally not a skip key. A scheduled run
    that slips past midnight records ``last_sent_date_*`` as the next day and
    used to make the real run for that day skip, even when it had new articles.

    Skip only when every article URL in this edition was already emailed for
    this language, or when the fallback path is about to re-send an older
    content date and we have no per-article history proving otherwise.
    """
    urls = article_urls(news_items)
    total = len(urls)
    if allow_resend:
        return NewsletterDecision(
            action="send",
            reason="allow_resend",
            message="Resend allowed; duplicate check bypassed.",
            new_count=total,
            total_count=total,
        )

    history = _history_entries(state, language)
    sent_urls = _sent_urls_for_language(state, language)
    new_count = sum(1 for url in urls if url not in sent_urls)

    if history and total > 0 and new_count == 0:
        return NewsletterDecision(
            action="skip",
            reason="duplicate_articles",
            message=(
                f"⏭️ Skip: {language.upper()} newsletter not sent. "
                f"All {total} articles were already emailed "
                f"(duplicate send / rerun). "
                f"Wall-clock date {target_date} is not the dedup key."
            ),
            new_count=0,
            total_count=total,
        )

    # Fallback editions (no items in the 3-day window) are labeled with an
    # older selected_date. Keep blocking those when that date was already
    # sent, unless per-article history shows these URLs were never emailed
    # (the wall-clock bug stamped a date without those articles).
    unsent_urls_known = bool(history) and new_count > 0
    if selected_date != target_date and selected_date in _content_dates_sent(state) and not unsent_urls_known:
        return NewsletterDecision(
            action="skip",
            reason="fallback_content_date",
            message=(
                f"⏭️ Skip: content for {selected_date} was already sent recently "
                f"(fallback re-send prevention). No new articles for {target_date}."
            ),
            new_count=new_count,
            total_count=total,
        )

    if total == 0:
        return NewsletterDecision(
            action="skip",
            reason="no_articles",
            message=f"⏭️ Skip: {language.upper()} newsletter has no article URLs.",
            new_count=0,
            total_count=0,
        )

    return NewsletterDecision(
        action="send",
        reason="new_articles",
        message=(
            f"{language.upper()} newsletter has {new_count} article(s) "
            f"not emailed yet ({total} in this edition)."
        ),
        new_count=new_count,
        total_count=total,
    )


def remember_sent_articles(
    state: dict,
    *,
    language: str,
    news_items: list[dict],
    target_date: str,
    selected_date: str,
    sent_at_kst: str,
    recipient_count: int,
) -> None:
    """Record the articles actually emailed. ``target_date`` is informational."""
    urls = article_urls(news_items)
    fingerprint = content_fingerprint(urls)
    content_dates = sorted(
        {
            str(item.get("published") or "").strip()
            for item in news_items
            if str(item.get("published") or "").strip()
        }
    )
    history = [
        entry
        for entry in _history_entries(state, language)
        if entry.get("fingerprint") != fingerprint
    ]
    history.append(
        {
            "fingerprint": fingerprint,
            "urls": urls,
            "content_dates": content_dates,
            "sent_on_kst_date": target_date,
            "selected_date": selected_date,
            "sent_at_kst": sent_at_kst,
        }
    )
    history = history[-14:]

    raw_dates = state.get("recently_sent_content_dates") or []
    recently_sent = [str(value) for value in raw_dates if value] if isinstance(raw_dates, list) else []
    if selected_date and selected_date not in recently_sent:
        recently_sent.append(selected_date)
    recently_sent = recently_sent[-14:]

    latest_content_date = content_dates[-1] if content_dates else selected_date
    state.update(
        {
            f"last_sent_date_{language}": target_date,
            f"last_sent_content_date_{language}": latest_content_date,
            f"last_sent_at_kst_{language}": sent_at_kst,
            f"last_recipient_count_{language}": recipient_count,
            "last_news_items": len(news_items),
            "recently_sent_content_dates": recently_sent,
            f"recently_sent_articles_{language}": history,
        }
    )


_REASON_TEXT = {
    "duplicate_articles": "these articles were already sent",
    "fallback_content_date": "that content date was already sent",
    "outside_window": "outside the send window",
    "no_articles": "no articles",
    "allow_resend": "resend allowed",
    "new_articles": "new articles",
    "subscribers": "subscriber lookup failed",
    "no_recipients": "no recipients",
    "load_news": "news could not be loaded",
    "no_items": "no items after filtering",
    "send": "send failed",
}


def format_newsletter_result(
    language: str,
    result: str,
    *,
    reason: str = "",
    items: int | None = None,
    new_items: int | None = None,
) -> str:
    """One machine-readable line. Tokens have no spaces so the workflow can parse them."""
    parts = [f"NEWSLETTER_RESULT language={language} result={result}"]
    if reason:
        parts.append(f"reason={reason}")
    if items is not None:
        parts.append(f"items={items}")
    if new_items is not None:
        parts.append(f"new={new_items}")
    return " ".join(parts)


def _parse_result_line(line: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for token in (line or "").split():
        if token == "NEWSLETTER_RESULT" or "=" not in token:
            continue
        key, value = token.split("=", 1)
        fields[key] = value
    return fields


def describe_newsletter_result(label: str, line: str) -> str:
    fields = _parse_result_line(line)
    result = fields.get("result", "")
    if result == "sent":
        return f"{label} newsletter was sent ({fields.get('items', '?')} items)"
    if result == "skipped":
        reason = _REASON_TEXT.get(fields.get("reason", ""), fields.get("reason") or "skipped")
        return f"{label} newsletter was skipped ({reason})"
    if result == "dry_run":
        return f"{label} newsletter dry-run only ({fields.get('items', '?')} items, not sent)"
    if result == "failed":
        reason = _REASON_TEXT.get(fields.get("reason", ""), "failed")
        return f"{label} newsletter failed ({reason})"
    return f"{label} newsletter status unknown"


def summarize_run_status(ko_line: str, en_line: str) -> str:
    """Notification text. Says skipped when a language was skipped."""
    return (
        "Daily pipeline completed. "
        f"{describe_newsletter_result('KO', ko_line)}. "
        f"{describe_newsletter_result('EN', en_line)}."
    )


def _status(
    language: str,
    code: int,
    result: str,
    *,
    reason: str = "",
    message: str = "",
    items: int | None = None,
    new_items: int | None = None,
) -> int:
    if message:
        print(message)
    print(format_newsletter_result(language, result, reason=reason, items=items, new_items=new_items))
    return code


def main() -> int:
    parser = argparse.ArgumentParser(description="Send daily newsletter for AI Commerce Daily.")
    parser.add_argument("--date", default=None, help="Target date (YYYY-MM-DD). Default: today in KST.")
    parser.add_argument("--send", action="store_true", help="Actually send email via Gmail API.")
    parser.add_argument("--force", action="store_true", help="Skip 05:00 KST window check.")
    parser.add_argument(
        "--allow-resend",
        action="store_true",
        help="Send even if these articles were already emailed.",
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
        "--language",
        choices=["ko", "en"],
        default="ko",
        help="Newsletter audience language.",
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
        return _status(
            args.language,
            0,
            "skipped",
            reason="outside_window",
            message=(
                f"⏭️ Skip: current KST time {now_kst.strftime('%Y-%m-%d %H:%M:%S')} "
                f"is outside send window (05:00-05:{end_minute:02d})."
            ),
        )

    # Decide from the articles this run would email, before any Google API call.
    # A delayed previous run can stamp today's KST date without having sent
    # today's articles; that must not block this edition.
    state = _load_json(STATE_PATH, default={})
    if not isinstance(state, dict):
        state = {}

    try:
        news_items, selected_date = _load_news_items(
            target_date=target_date, max_items=args.max_items, language=args.language
        )
    except Exception as error:
        return _status(
            args.language,
            1,
            "failed",
            reason="load_news",
            message=f"❌ Failed to load newsletter news: {error}",
        )

    if not news_items:
        return _status(
            args.language,
            1,
            "failed",
            reason="no_items",
            message=(
                f"🚫 BLOCKED: 0 news items after filtering for {target_date}. Newsletter NOT sent.\n"
                "   Possible cause: summarized.json items missing 'link' field.\n"
                "   Fix: check sync_obsidian_to_summarized.py URL parsing."
            ),
        )

    decision = decide_newsletter_send(
        news_items=news_items,
        state=state,
        language=args.language,
        target_date=target_date,
        selected_date=selected_date,
        allow_resend=args.allow_resend,
    )
    if decision.action == "skip":
        return _status(
            args.language,
            0,
            "skipped",
            reason=decision.reason,
            message=decision.message,
            items=decision.total_count,
            new_items=decision.new_count,
        )

    lang_key = f"last_sent_date_{args.language}"
    wall_clock_already_used = state.get(lang_key) == target_date or (
        args.language == "ko" and state.get("last_sent_date") == target_date and lang_key not in state
    )
    if wall_clock_already_used:
        print(
            f"ℹ️ {args.language.upper()} state already records wall-clock date {target_date}, "
            f"but {decision.new_count} of {decision.total_count} article(s) were not emailed yet. Sending."
        )
    else:
        print(decision.message)

    if len(news_items) < 3:
        print(f"⚠️ WARNING: Only {len(news_items)} items for {target_date}. Proceeding but quality may be low.")

    from get_subscribers import get_subscribers  # noqa: E402
    from send_newsletter import generate_html_newsletter, send_newsletter  # noqa: E402

    try:
        subscribers = get_subscribers(verbose=True, language=args.language)
    except Exception as error:
        return _status(
            args.language,
            1,
            "failed",
            reason="subscribers",
            message=f"❌ Failed to fetch subscribers: {error}",
        )

    recipients = list(dict.fromkeys([*subscribers, *args.recipient]))
    if not recipients:
        return _status(
            args.language,
            1,
            "failed",
            reason="no_recipients",
            message="⚠️ No recipients available. Check spreadsheet ID or pass --recipient for test.",
        )

    # Load insights if available
    insights_path = DATA_DIR / "newsletter_insights.json"
    insights_data = _load_json(insights_path, default={})
    insights_list = insights_data.get("insights", []) if insights_data.get("date") == selected_date else []

    html = generate_html_newsletter(news_items, date_str=selected_date, insights=insights_list, language=args.language)
    preview_path = Path(args.preview_path)
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    preview_path.write_text(html, encoding="utf-8")
    print(f"📝 Preview saved: {preview_path}")

    subject = _build_subject(selected_date, language=args.language)
    success = send_newsletter(
        to_emails=recipients,
        subject=subject,
        html_content=html,
        dry_run=not args.send,
    )
    if not success:
        return _status(args.language, 1, "failed", reason="send", items=len(news_items), new_items=decision.new_count)

    mode = "send" if args.send else "dry-run"
    print(
        f"✅ Newsletter {mode} completed "
        f"(date={selected_date}, recipients={len(recipients)}, items={len(news_items)})."
    )

    if not args.send:
        return _status(
            args.language,
            0,
            "dry_run",
            items=decision.total_count,
            new_items=decision.new_count,
        )

    remember_sent_articles(
        state,
        language=args.language,
        news_items=news_items,
        target_date=target_date,
        selected_date=selected_date,
        sent_at_kst=now_kst.isoformat(),
        recipient_count=len(recipients),
    )
    _save_json(STATE_PATH, state)
    print(f"📌 Send state updated: {STATE_PATH}")

    try:
        from sync_obsidian_to_summarized import record_sent_titles
        record_sent_titles(news_items, selected_date)
        print(f"🔄 Dedup history updated: {len(news_items)} titles recorded")
    except Exception as error:
        print(f"⚠️ Dedup history update failed: {error}")

    return _status(
        args.language,
        0,
        "sent",
        items=decision.total_count,
        new_items=decision.new_count,
    )


if __name__ == "__main__":
    raise SystemExit(main())
