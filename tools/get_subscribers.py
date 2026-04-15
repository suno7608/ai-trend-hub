#!/usr/bin/env python3
"""Fetch newsletter subscribers from Google Sheets."""

from __future__ import annotations

import argparse
import json
import os
import re
from typing import Iterable

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

# KR and EN subscribers are stored in separate Google Sheets.
KR_SPREADSHEET_ID = "1j0Bp3uFtUj5JhSiwDjI53exHgoWdK61DdtdphcxmU7c"
EN_SPREADSHEET_ID = "18raZEl8XvctJPUigvN2g7DNSjLSV4_fHcZQgcu0bHs0"
SPREADSHEET_ID = KR_SPREADSHEET_ID
# Multiple sheets: old form (시트2) + new public form (시트3)
DEFAULT_RANGE_NAMES = ["설문지 응답 시트2!B2:B", "설문지 응답 시트3!B2:C"]
KO_RANGE_NAMES = ["설문지 응답 시트2!B2:B", "설문지 응답 시트3!B2:C"]
EN_RANGE_NAMES = ["EN_newsletter!B2:B"]
TOKEN_PATH = os.environ.get("GOOGLE_TOKEN_PATH", os.path.expanduser("~/.openclaw/workspace/tools/google-token.json"))
EMAIL_PATTERN = re.compile(r"^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,63}$", re.IGNORECASE)

# Blocklist: emails that should never receive newsletters (bounce/delivery issues)
BLOCKED_EMAILS: set[str] = {
    "ektjs88@gmail.com",
}


def normalize_email(raw: str) -> str:
    """Normalize a candidate email for dedupe/validation."""
    return raw.strip().lower()


def is_valid_email(email: str) -> bool:
    """Return True if email format is valid enough for newsletter sending."""
    return bool(EMAIL_PATTERN.match(email))


def _load_credentials(token_path: str = TOKEN_PATH) -> Credentials:
    if not os.path.exists(token_path):
        raise FileNotFoundError(
            f"Token file not found: {token_path}. Run Google auth first."
        )
    return Credentials.from_authorized_user_file(token_path, SCOPES)


def _extract_unique_valid_emails(rows: Iterable[list[str]]) -> tuple[list[str], dict[str, int]]:
    emails: list[str] = []
    seen: set[str] = set()
    stats = {"empty": 0, "invalid": 0, "duplicates": 0}

    for row in rows:
        raw = (row[0] if row else "").strip()
        if not raw:
            stats["empty"] += 1
            continue

        email = normalize_email(raw)
        if not is_valid_email(email):
            stats["invalid"] += 1
            continue
        if email in BLOCKED_EMAILS:
            stats.setdefault("blocked", 0)
            stats["blocked"] += 1
            continue
        if email in seen:
            stats["duplicates"] += 1
            continue

        emails.append(email)
        seen.add(email)

    return emails, stats


def get_subscribers(
    spreadsheet_id: str | None = None,
    range_names: list[str] | None = None,
    token_path: str = TOKEN_PATH,
    verbose: bool = False,
    language: str = "all",
) -> list[str]:
    """
    Return subscriber email list from Google Sheets (multiple sheets).

    Returns:
        list[str]: Unique, normalized, validated emails.
    """
    if spreadsheet_id:
        resolved_spreadsheet_id = spreadsheet_id
    elif language == "en":
        resolved_spreadsheet_id = os.getenv("NEWSLETTER_EN_SPREADSHEET_ID", EN_SPREADSHEET_ID)
    else:
        resolved_spreadsheet_id = os.getenv("NEWSLETTER_SPREADSHEET_ID", KR_SPREADSHEET_ID)
    if not resolved_spreadsheet_id or resolved_spreadsheet_id == "YOUR_SPREADSHEET_ID_HERE":
        print("⚠️ SPREADSHEET_ID is not configured. Set NEWSLETTER_SPREADSHEET_ID env var or update get_subscribers.py.")
        return []

    if range_names:
        resolved_ranges = range_names
    elif language == "ko":
        resolved_ranges = KO_RANGE_NAMES
    elif language == "en":
        resolved_ranges = EN_RANGE_NAMES
    else:
        resolved_ranges = DEFAULT_RANGE_NAMES + EN_RANGE_NAMES

    try:
        creds = _load_credentials(token_path=token_path)
        service = build("sheets", "v4", credentials=creds)
    except FileNotFoundError as error:
        print(f"❌ {error}")
        return []
    except Exception as error:
        print(f"❌ Failed to initialize Sheets API: {error}")
        return []

    all_rows: list[list[str]] = []
    for range_name in resolved_ranges:
        try:
            result = (
                service.spreadsheets()
                .values()
                .get(spreadsheetId=resolved_spreadsheet_id, range=range_name)
                .execute()
            )
            rows = result.get("values", [])
            # Flatten: each row may have multiple email columns
            for row in rows:
                for cell in row:
                    all_rows.append([cell])
            if verbose:
                print(f"ℹ️ {range_name}: {len(rows)} rows")
        except HttpError as error:
            print(f"⚠️ Skipping {range_name}: {error}")
        except Exception as error:
            print(f"⚠️ Skipping {range_name}: {error}")

    if not all_rows:
        print("⚠️ No subscriber rows found.")
        return []

    emails, stats = _extract_unique_valid_emails(all_rows)
    if verbose:
        print(
            "ℹ️ Total parse stats - "
            f"rows: {len(all_rows)}, valid: {len(emails)}, "
            f"empty: {stats['empty']}, invalid: {stats['invalid']}, "
            f"blocked: {stats.get('blocked', 0)}, duplicates: {stats['duplicates']}"
        )

    return emails


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch subscriber emails from Google Sheets.")
    parser.add_argument("--json", action="store_true", help="Print result as JSON array.")
    parser.add_argument("--verbose", action="store_true", help="Print parse stats.")
    parser.add_argument("--spreadsheet-id", default=None, help="Override spreadsheet ID.")
    parser.add_argument("--range", dest="range_name", default=None, help="A1 range (overrides default multi-sheet).")
    parser.add_argument("--language", choices=["all", "ko", "en"], default="all", help="Filter subscriber source by language.")
    args = parser.parse_args()

    range_names = [args.range_name] if args.range_name else None
    subscribers = get_subscribers(
        spreadsheet_id=args.spreadsheet_id, range_names=range_names, verbose=args.verbose, language=args.language
    )

    if args.json:
        print(json.dumps(subscribers, ensure_ascii=False, indent=2))
    else:
        print(f"✅ Subscribers: {len(subscribers)}")
        for idx, email in enumerate(subscribers, start=1):
            print(f"{idx}. {email}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
