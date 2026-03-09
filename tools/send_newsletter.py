#!/usr/bin/env python3
"""Build and send AI Commerce Daily newsletters using Gmail API."""

from __future__ import annotations

import argparse
import base64
import os
import re
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape
from pathlib import Path

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]
TOKEN_PATH = os.path.expanduser("~/.openclaw/workspace/tools/google-token.json")
DEFAULT_FROM_EMAIL = "suno7608@gmail.com"
DEFAULT_UNSUBSCRIBE_URL = (
    "mailto:suno7608@gmail.com?subject=%EA%B5%AC%EB%8F%85%20%EC%B7%A8%EC%86%8C"
)
EMAIL_PATTERN = re.compile(r"^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,63}$", re.IGNORECASE)


def normalize_email(raw: str) -> str:
    return raw.strip().lower()


def is_valid_email(email: str) -> bool:
    return bool(EMAIL_PATTERN.match(email))


def _clean_recipients(to_emails: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()

    for email in to_emails:
        normalized = normalize_email(email)
        if not normalized or not is_valid_email(normalized):
            continue
        if normalized in seen:
            continue
        seen.add(normalized)
        cleaned.append(normalized)
    return cleaned


def _strip_html(html_content: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", "", html_content)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def send_newsletter(
    to_emails: list[str],
    subject: str,
    html_content: str,
    from_email: str = DEFAULT_FROM_EMAIL,
    token_path: str = TOKEN_PATH,
    dry_run: bool = True,
) -> bool:
    """
    Send newsletter to all recipients in BCC.

    Notes:
        - `dry_run=True` by default to prevent accidental sends.
        - Actual send happens only when `dry_run=False`.
    """
    recipients = _clean_recipients(to_emails)
    if not recipients:
        print("⚠️ No valid recipients after validation.")
        return False
    if not subject.strip():
        print("❌ Empty subject is not allowed.")
        return False
    if not html_content.strip():
        print("❌ Empty HTML content is not allowed.")
        return False

    message = MIMEMultipart("alternative")
    message["From"] = from_email
    message["To"] = from_email
    message["Bcc"] = ", ".join(recipients)
    message["Subject"] = subject

    plain_body = _strip_html(html_content)
    message.attach(MIMEText(plain_body, "plain", "utf-8"))
    message.attach(MIMEText(html_content, "html", "utf-8"))

    if dry_run:
        print("🧪 Dry run mode enabled. Skipping Gmail API send.")
        print(f"   Subject: {subject}")
        print(f"   Recipients(BCC): {len(recipients)}")
        print(f"   Sample: {', '.join(recipients[:5])}")
        return True

    if not os.path.exists(token_path):
        print(f"❌ Token file not found: {token_path}")
        return False

    try:
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        service = build("gmail", "v1", credentials=creds)
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
        result = service.users().messages().send(userId="me", body={"raw": raw}).execute()
        print(f"✅ Email sent to {len(recipients)} recipients.")
        print(f"   Message ID: {result.get('id', 'N/A')}")
        return True
    except Exception as error:
        print(f"❌ Failed to send newsletter: {error}")
        return False


def _render_item_card(item: dict) -> str:
    """Render a single news item card."""
    emoji = escape(str(item.get("emoji", "📰")))
    title = escape(str(item.get("title", "제목 없음")))
    source = escape(str(item.get("source", "")))
    published = escape(str(item.get("published", "")))
    summary = escape(str(item.get("summary", "")))
    url = escape(str(item.get("url", "#")), quote=True)

    meta = " · ".join(part for part in [source, published] if part)
    return f"""
            <tr>
              <td style="padding:0 0 16px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background:#1e1b2e;border-radius:14px;border:1px solid #2d2a3e;">
                  <tr>
                    <td style="padding:18px 18px 14px 18px;">
                      <div style="font-size:18px;font-weight:700;line-height:1.4;color:#f0eeff;">{emoji} {title}</div>
                      <div style="margin-top:6px;font-size:12px;color:#9d99b0;">{meta}</div>
                      <div style="margin-top:12px;font-size:14px;line-height:1.65;color:#cbc7e0;">{summary}</div>
                      <div style="margin-top:14px;">
                        <a href="{url}" target="_blank" rel="noopener" style="color:#a78bfa;text-decoration:none;font-size:13px;font-weight:700;">Read More →</a>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            """


def _render_section_header(title: str, emoji: str) -> str:
    """Render a category section header."""
    return f"""
            <tr>
              <td style="padding:24px 0 12px 0;">
                <div style="font-size:20px;font-weight:800;color:#a78bfa;letter-spacing:0.3px;">{emoji} {escape(title)}</div>
                <div style="margin-top:6px;height:2px;background:linear-gradient(90deg,#5f37ff,transparent);border-radius:2px;"></div>
              </td>
            </tr>
            """


def _render_insights_section(insights: list[str]) -> str:
    """Render the insights & implications section."""
    if not insights:
        return ""
    items_html = ""
    for insight in insights:
        items_html += f"""<li style="margin-bottom:10px;font-size:14px;line-height:1.65;color:#cbc7e0;">{escape(insight)}</li>"""
    return f"""
            <tr>
              <td style="padding:8px 0 16px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background:#1a1730;border-radius:14px;border:1px solid #3d2a6e;">
                  <tr>
                    <td style="padding:18px 18px 14px 18px;">
                      <div style="font-size:18px;font-weight:800;color:#cf7bff;margin-bottom:12px;">💡 인사이트 &amp; 시사점</div>
                      <ul style="margin:0;padding-left:20px;">{items_html}</ul>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            """


# Category display order and labels
CATEGORY_SECTIONS = [
    ("ai_commerce", "🛍️ AI 커머스 주요 동향"),
    ("ai_marketing", "🎯 AI 마케팅 트렌드"),
    ("commerce", "🏪 D2C/이커머스 AI 활용 사례"),
]


def generate_html_newsletter(
    news_items: list[dict],
    date_str: str | None = None,
    unsubscribe_url: str = DEFAULT_UNSUBSCRIBE_URL,
    insights: list[str] | None = None,
) -> str:
    """Generate styled newsletter HTML with category sections."""
    if date_str is None:
        date_str = datetime.now().strftime("%Y-%m-%d")

    # Group items by category
    grouped: dict[str, list[dict]] = {}
    for item in news_items:
        cats = item.get("categories", ["ai_commerce"])
        cat = cats[0] if cats else "ai_commerce"
        grouped.setdefault(cat, []).append(item)

    items_html_parts: list[str] = []
    has_sections = len(grouped) > 1

    for cat_key, cat_label in CATEGORY_SECTIONS:
        cat_items = grouped.pop(cat_key, [])
        if not cat_items:
            continue
        if has_sections:
            items_html_parts.append(_render_section_header(cat_label.split(" ", 1)[1], cat_label.split(" ")[0]))
        for item in cat_items:
            items_html_parts.append(_render_item_card(item))

    # Any remaining categories
    for cat_key, cat_items in grouped.items():
        if not cat_items:
            continue
        if has_sections:
            items_html_parts.append(_render_section_header("기타", "📰"))
        for item in cat_items:
            items_html_parts.append(_render_item_card(item))

    # Add insights section
    if insights:
        items_html_parts.append(_render_insights_section(insights))

    items_html = "\n".join(items_html_parts) or """
            <tr><td style="padding:12px 0;color:#9d99b0;">No news items available today.</td></tr>
    """

    return f"""<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>AI Commerce Daily | {escape(date_str)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0d0b14;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      AI Commerce Daily {escape(date_str)}: 오늘의 핵심 AI 커머스/마케팅 뉴스 요약
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0b14;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#13111c;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:30px 24px;background:linear-gradient(135deg,#5f37ff 0%,#9a5bff 55%,#cf7bff 100%);color:#ffffff;">
                <div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;opacity:0.95;">AI Commerce Daily</div>
                <h1 style="margin:8px 0 8px 0;font-size:30px;line-height:1.25;color:#ffffff;">매일 아침 5시, 핵심 뉴스만</h1>
                <p style="margin:0;font-size:14px;line-height:1.6;opacity:0.95;color:#f0eeff;">
                  AI 커머스 &amp; 마케팅 인사이트를 빠르게 확인하세요.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;border-bottom:1px solid #2d2a3e;background:#18152a;font-size:13px;color:#9d99b0;">
                발행일: {escape(date_str)}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 8px 24px;background:#13111c;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{items_html}</table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 12px 24px;background:#18152a;border-top:1px solid #2d2a3e;">
                <div style="text-align:center;margin-bottom:16px;">
                  <div style="font-size:13px;font-weight:700;color:#a78bfa;letter-spacing:0.5px;margin-bottom:10px;">📚 더 많은 인사이트 보기</div>
                  <a href="https://suno7608.github.io/ai-trend-hub/" target="_blank" rel="noopener" style="display:inline-block;padding:10px 22px;background:linear-gradient(135deg,#5f37ff,#9a5bff);color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:700;margin:0 4px 8px 4px;">📊 AI Trend Hub</a>
                  <a href="https://suno7608.github.io/d2c-intel/" target="_blank" rel="noopener" style="display:inline-block;padding:10px 22px;background:linear-gradient(135deg,#5f37ff,#9a5bff);color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:700;margin:0 4px 8px 4px;">🌐 D2C Intelligence Hub</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px 22px 24px;background:#0d0b14;color:#9d99b0;font-size:12px;line-height:1.7;">
                <div style="font-weight:700;color:#f0eeff;">AI Commerce Daily</div>
                <div>이 이메일은 구독자에게 발송되었습니다.</div>
                <div style="margin-top:8px;">
                  구독 취소:
                  <a href="{escape(unsubscribe_url, quote=True)}" style="color:#a78bfa;text-decoration:none;">unsubscribe</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Send AI Commerce Daily newsletter.")
    parser.add_argument("--send", action="store_true", help="Actually send via Gmail API.")
    parser.add_argument("--to", action="append", default=[], help="Recipient email (repeatable).")
    parser.add_argument("--subject", default=None, help="Email subject.")
    parser.add_argument("--date", dest="date_str", default=None, help="Newsletter date (YYYY-MM-DD).")
    parser.add_argument(
        "--preview-out",
        default="data/newsletter_preview.html",
        help="Path to write generated HTML preview.",
    )
    args = parser.parse_args()

    date_str = args.date_str or datetime.now().strftime("%Y-%m-%d")
    subject = args.subject or f"[AI Commerce Daily] {date_str} AI 커머스 & 마케팅 뉴스"

    demo_items = [
        {
            "emoji": "🤖",
            "title": "AI 에이전트 기반 쇼핑 검색 전환 가속",
            "source": "Tech Source",
            "published": date_str,
            "summary": "검색에서 구매까지 이어지는 퍼널이 짧아지면서 추천 품질과 상품 데이터가 핵심이 되고 있습니다.",
            "url": "https://example.com/news/1",
        },
        {
            "emoji": "🛒",
            "title": "리테일 기업의 개인화 CRM 실험 확대",
            "source": "Retail Insight",
            "published": date_str,
            "summary": "LTV 기반 세그먼트로 캠페인 자동화를 고도화하는 사례가 늘고 있습니다.",
            "url": "https://example.com/news/2",
        },
    ]

    html = generate_html_newsletter(demo_items, date_str=date_str)
    preview_path = Path(args.preview_out)
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    preview_path.write_text(html, encoding="utf-8")
    print(f"📝 HTML preview written to: {preview_path}")

    recipients = args.to if args.to else [DEFAULT_FROM_EMAIL]
    success = send_newsletter(
        to_emails=recipients,
        subject=subject,
        html_content=html,
        dry_run=not args.send,
    )
    return 0 if success else 1


if __name__ == "__main__":
    raise SystemExit(main())
