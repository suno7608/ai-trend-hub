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

# Keep placeholder until real spreadsheet is ready.
SPREADSHEET_ID = "1j0Bp3uFtUj5JhSiwDjI53exHgoWdK61DdtdphcxmU7c"
RANGE_NAME = "설문지 응답 시트2!B2:B"
TOKEN_PATH = os.path.expanduser("~/.openclaw/workspace/tools/google-token.json")
EMAIL_PATTERN = re.compile(r"^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,63}$", re.IGNORECASE)


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
        if email in seen:
            stats["duplicates"] += 1
            continue

        emails.append(email)
        seen.add(email)

    return emails, stats


def get_subscribers(
    spreadsheet_id: str | None = None,
    range_name: str = RANGE_NAME,
    token_path: str = TOKEN_PATH,
    verbose: bool = False,
) -> list[str]:
    """
    Return subscriber email list from Google Sheets.

    Returns:
        list[str]: Unique, normalized, validated emails.
    """
    resolved_spreadsheet_id = spreadsheet_id or os.getenv(
        "NEWSLETTER_SPREADSHEET_ID", SPREADSHEET_ID
    )
    if not resolved_spreadsheet_id or resolved_spreadsheet_id == "YOUR_SPREADSHEET_ID_HERE":
        print("⚠️ SPREADSHEET_ID is not configured. Set NEWSLETTER_SPREADSHEET_ID env var or update get_subscribers.py.")
        return []

    try:
        creds = _load_credentials(token_path=token_path)
        service = build("sheets", "v4", credentials=creds)
        result = (
            service.spreadsheets()
            .values()
            .get(spreadsheetId=resolved_spreadsheet_id, range=range_name)
            .execute()
        )
    except FileNotFoundError as error:
        print(f"❌ {error}")
        return []
    except HttpError as error:
        print(f"❌ Google Sheets API error: {error}")
        return []
    except Exception as error:
        print(f"❌ Failed to read subscribers: {error}")
        return []

    values = result.get("values", [])
    if not values:
        print("⚠️ No subscriber rows found.")
        return []

    emails, stats = _extract_unique_valid_emails(values)
    if verbose:
        print(
            "ℹ️ Sheet parse stats - "
            f"rows: {len(values)}, valid: {len(emails)}, "
            f"empty: {stats['empty']}, invalid: {stats['invalid']}, duplicates: {stats['duplicates']}"
        )

    return emails


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch subscriber emails from Google Sheets.")
    parser.add_argument("--json", action="store_true", help="Print result as JSON array.")
    parser.add_argument("--verbose", action="store_true", help="Print parse stats.")
    parser.add_argument("--spreadsheet-id", default=None, help="Override spreadsheet ID.")
    parser.add_argument("--range", dest="range_name", default=RANGE_NAME, help="A1 range.")
    args = parser.parse_args()

    subscribers = get_subscribers(
        spreadsheet_id=args.spreadsheet_id, range_name=args.range_name, verbose=args.verbose
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
