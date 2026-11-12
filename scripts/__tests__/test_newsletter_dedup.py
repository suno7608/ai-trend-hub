"""Dedup, notification text, schedule, and Pages-deploy wiring.

The 2026-11-09 scheduled run did not start until 2026-11-10 00:08 KST
(commit b79ff22, 2026-11-09 15:08 UTC). It emailed that run's articles but
recorded last_sent_date_ko/en and recently_sent_content_dates as 2026-11-10.
The real 2026-11-10 run then hit:

    Skip: KO newsletter already marked sent for 2026-11-10

and the 15 articles collected that day were never emailed. The Telegram
success text still said the newsletters were sent.
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import newsletter_sender as ns  # noqa: E402
from newsletter_sender import (  # noqa: E402
    decide_newsletter_send,
    describe_newsletter_result,
    format_newsletter_result,
    remember_sent_articles,
    summarize_run_status,
)


def _items(prefix: str, date: str, count: int) -> list[dict]:
    return [
        {
            "url": f"https://example.com/{prefix}-{index}",
            "title": f"{prefix} {index}",
            "published": date,
        }
        for index in range(count)
    ]


def _incident_state() -> dict:
    """State written by the delayed 2026-11-09 run. No per-article URL history."""
    return {
        "last_sent_date_ko": "2026-11-10",
        "last_sent_date_en": "2026-11-10",
        "last_sent_content_date_ko": "2026-11-10",
        "last_sent_content_date_en": "2026-11-10",
        "last_sent_at_kst_ko": "2026-11-10T00:08:44.699260+09:00",
        "recently_sent_content_dates": [
            "2026-10-29",
            "2026-10-30",
            "2026-10-31",
            "2026-11-01",
            "2026-11-02",
            "2026-11-03",
            "2026-11-04",
            "2026-11-05",
            "2026-11-06",
            "2026-11-07",
            "2026-11-08",
            "2026-11-10",
        ],
    }


class NewsletterDedupTest(unittest.TestCase):
    def test_three_day_window_labels_edition_with_the_wall_clock_date(self) -> None:
        """Articles from Nov 9 collected after midnight are still labeled Nov 10.

        That is why dedup cannot key off selected_date: the 3-day window keeps
        selected_date equal to the run's KST date whenever any item falls in it.
        """
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "archive").mkdir()
            items = [
                {
                    "link": "https://example.com/nov9-only",
                    "date_published": "2026-11-09",
                    "title": "Nov 9 article",
                    "summary_ko": "Collected by the run that slipped past midnight.",
                    "source_name": "Example",
                    "categories": ["ai_commerce"],
                    "relevance_score": 0.9,
                    "confidence": 0.9,
                }
            ]
            summarized = root / "summarized.json"
            summarized.write_text(json.dumps(items), encoding="utf-8")
            old_summarized, old_data = ns.SUMMARIZED_PATH, ns.DATA_DIR
            ns.SUMMARIZED_PATH = summarized
            ns.DATA_DIR = root
            try:
                edition, selected_date = ns._load_news_items("2026-11-10", max_items=12, language="ko")
            finally:
                ns.SUMMARIZED_PATH = old_summarized
                ns.DATA_DIR = old_data
        self.assertEqual(selected_date, "2026-11-10")
        self.assertEqual(edition[0]["published"], "2026-11-09")
        self.assertEqual(edition[0]["url"], "https://example.com/nov9-only")

    def test_delayed_run_stamping_today_does_not_skip_new_articles(self) -> None:
        """Dry-run of the 2026-11-10 miss: 15 new URLs must still send."""
        state = _incident_state()
        edition = _items("nov10", "2026-11-10", 15)
        decision = decide_newsletter_send(
            news_items=edition,
            state=state,
            language="ko",
            target_date="2026-11-10",
            selected_date="2026-11-10",
            allow_resend=False,
        )
        report = (
            "INCIDENT DRY-RUN\n"
            "Delayed 2026-11-09 run recorded last_sent_date_ko=2026-11-10 "
            "at 2026-11-10 00:08 KST, with no article URLs stored.\n"
            f"Real 2026-11-10 edition: {len(edition)} new articles.\n"
            f"Decision: {decision.action} reason={decision.reason} "
            f"new={decision.new_count} total={decision.total_count}\n"
            "Previous behavior: Skip: KO newsletter already marked sent for 2026-11-10"
        )
        print(report)
        self.assertEqual(decision.action, "send")
        self.assertEqual(decision.reason, "new_articles")
        self.assertEqual(decision.new_count, 15)
        self.assertNotIn("2026-11-09", state["recently_sent_content_dates"])

    def test_rerun_of_the_same_articles_is_skipped(self) -> None:
        state = _incident_state()
        edition = _items("nov10", "2026-11-10", 15)
        remember_sent_articles(
            state,
            language="ko",
            news_items=edition,
            target_date="2026-11-10",
            selected_date="2026-11-10",
            sent_at_kst="2026-11-10T22:28:00+09:00",
            recipient_count=66,
        )
        rerun = decide_newsletter_send(
            news_items=edition,
            state=state,
            language="ko",
            target_date="2026-11-10",
            selected_date="2026-11-10",
            allow_resend=False,
        )
        print(
            "RERUN DRY-RUN\n"
            f"After the 15 articles are recorded, the same edition is "
            f"{rerun.action} ({rerun.reason})."
        )
        self.assertEqual(rerun.action, "skip")
        self.assertEqual(rerun.reason, "duplicate_articles")
        line = format_newsletter_result("ko", "skipped", reason=rerun.reason, items=15, new_items=0)
        self.assertTrue(line.startswith("NEWSLETTER_RESULT "))
        self.assertNotIn(" ", line.split(" ", 1)[1].split("=")[0])

    def test_late_run_that_records_urls_does_not_block_the_next_edition(self) -> None:
        """Future shape: the midnight run stores the URLs it actually sent."""
        state: dict = {"recently_sent_content_dates": ["2026-11-08"]}
        late_edition = _items("nov9", "2026-11-09", 9)
        remember_sent_articles(
            state,
            language="ko",
            news_items=late_edition,
            target_date="2026-11-10",  # wall clock after midnight
            selected_date="2026-11-10",
            sent_at_kst="2026-11-10T00:08:44+09:00",
            recipient_count=66,
        )
        self.assertEqual(state["last_sent_date_ko"], "2026-11-10")
        self.assertEqual(state["last_sent_content_date_ko"], "2026-11-09")
        stored_urls = state["recently_sent_articles_ko"][0]["urls"]
        self.assertEqual(len(stored_urls), 9)

        real_edition = _items("nov10", "2026-11-10", 15)
        decision = decide_newsletter_send(
            news_items=real_edition,
            state=state,
            language="ko",
            target_date="2026-11-10",
            selected_date="2026-11-10",
            allow_resend=False,
        )
        print(
            "URL-HISTORY DRY-RUN\n"
            "Midnight run stored 9 Nov 9 URLs while stamping sent_on=2026-11-10.\n"
            f"Real Nov 10 edition decision: {decision.action} "
            f"reason={decision.reason} new={decision.new_count}"
        )
        self.assertEqual(decision.action, "send")
        self.assertEqual(decision.new_count, 15)

    def test_partial_overlap_still_sends(self) -> None:
        state: dict = {}
        remember_sent_articles(
            state,
            language="ko",
            news_items=_items("shared", "2026-11-09", 4),
            target_date="2026-11-09",
            selected_date="2026-11-09",
            sent_at_kst="2026-11-09T15:00:00+09:00",
            recipient_count=10,
        )
        mixed = _items("shared", "2026-11-09", 4) + _items("fresh", "2026-11-10", 3)
        decision = decide_newsletter_send(
            news_items=mixed,
            state=state,
            language="ko",
            target_date="2026-11-10",
            selected_date="2026-11-10",
            allow_resend=False,
        )
        self.assertEqual(decision.action, "send")
        self.assertEqual(decision.new_count, 3)

    def test_languages_are_independent(self) -> None:
        state: dict = {}
        edition = _items("same", "2026-11-10", 5)
        remember_sent_articles(
            state,
            language="ko",
            news_items=edition,
            target_date="2026-11-10",
            selected_date="2026-11-10",
            sent_at_kst="2026-11-10T12:17:00+09:00",
            recipient_count=66,
        )
        english = decide_newsletter_send(
            news_items=edition,
            state=state,
            language="en",
            target_date="2026-11-10",
            selected_date="2026-11-10",
            allow_resend=False,
        )
        korean_rerun = decide_newsletter_send(
            news_items=edition,
            state=state,
            language="ko",
            target_date="2026-11-10",
            selected_date="2026-11-10",
            allow_resend=False,
        )
        self.assertEqual(english.action, "send")
        self.assertEqual(korean_rerun.action, "skip")

    def test_fallback_content_date_still_blocks_a_resend_without_url_history(self) -> None:
        state = _incident_state()
        old = _items("archive", "2026-11-08", 6)
        decision = decide_newsletter_send(
            news_items=old,
            state=state,
            language="ko",
            target_date="2026-11-12",
            selected_date="2026-11-08",
            allow_resend=False,
        )
        self.assertEqual(decision.action, "skip")
        self.assertEqual(decision.reason, "fallback_content_date")

    def test_fallback_sends_when_history_shows_those_urls_were_never_emailed(self) -> None:
        state = _incident_state()
        remember_sent_articles(
            state,
            language="ko",
            news_items=_items("other", "2026-11-10", 4),
            target_date="2026-11-10",
            selected_date="2026-11-10",
            sent_at_kst="2026-11-10T00:08:00+09:00",
            recipient_count=66,
        )
        unseen = _items("archive", "2026-11-08", 6)
        decision = decide_newsletter_send(
            news_items=unseen,
            state=state,
            language="ko",
            target_date="2026-11-12",
            selected_date="2026-11-08",
            allow_resend=False,
        )
        self.assertEqual(decision.action, "send")
        self.assertEqual(decision.new_count, 6)

    def test_allow_resend_bypasses_duplicate_urls(self) -> None:
        state: dict = {}
        edition = _items("nov10", "2026-11-10", 3)
        remember_sent_articles(
            state,
            language="en",
            news_items=edition,
            target_date="2026-11-10",
            selected_date="2026-11-10",
            sent_at_kst="2026-11-10T12:00:00+09:00",
            recipient_count=2,
        )
        decision = decide_newsletter_send(
            news_items=edition,
            state=state,
            language="en",
            target_date="2026-11-10",
            selected_date="2026-11-10",
            allow_resend=True,
        )
        self.assertEqual(decision.action, "send")
        self.assertEqual(decision.reason, "allow_resend")

    def test_article_history_keeps_the_last_14_editions(self) -> None:
        state: dict = {}
        for index in range(16):
            remember_sent_articles(
                state,
                language="ko",
                news_items=_items(f"day{index}", "2026-11-01", 1),
                target_date=f"2026-11-{index + 1:02d}",
                selected_date=f"2026-11-{index + 1:02d}",
                sent_at_kst="2026-11-12T12:00:00+09:00",
                recipient_count=1,
            )
        history = state["recently_sent_articles_ko"]
        self.assertEqual(len(history), 14)
        self.assertNotIn("https://example.com/day0-0", history[0]["urls"])
        self.assertIn("https://example.com/day15-0", history[-1]["urls"])


class NotificationTextTest(unittest.TestCase):
    def test_skipped_newsletter_is_not_described_as_sent(self) -> None:
        ko = format_newsletter_result("ko", "skipped", reason="duplicate_articles", items=12, new_items=0)
        en = format_newsletter_result("en", "skipped", reason="duplicate_articles", items=12, new_items=0)
        text = summarize_run_status(ko, en)
        print(f"NOTIFY DRY-RUN\n{text}")
        self.assertIn("KO newsletter was skipped", text)
        self.assertIn("EN newsletter was skipped", text)
        self.assertNotIn("was sent", text)
        self.assertNotIn("newsletters sent", text.lower())

    def test_mixed_and_sent_summaries(self) -> None:
        sent = format_newsletter_result("ko", "sent", items=15, new_items=15)
        skipped = format_newsletter_result("en", "skipped", reason="fallback_content_date")
        text = summarize_run_status(sent, skipped)
        self.assertIn("KO newsletter was sent (15 items)", text)
        self.assertIn("EN newsletter was skipped (that content date was already sent)", text)
        self.assertEqual(
            describe_newsletter_result("KO", ""),
            "KO newsletter status unknown",
        )

    def test_workflow_uses_the_summary_instead_of_a_hardcoded_sent_line(self) -> None:
        workflow = (ROOT / ".github/workflows/daily-content.yml").read_text(encoding="utf-8")
        self.assertNotIn("KR/EN newsletters sent", workflow)
        self.assertIn("steps.newsletter.outputs.summary", workflow)
        self.assertIn("summarize_run_status", workflow)


class ScheduleAndDeployTest(unittest.TestCase):
    def test_daily_cron_moved_earlier_and_off_the_hour(self) -> None:
        daily = (ROOT / ".github/workflows/daily-content.yml").read_text(encoding="utf-8")
        weekly = (ROOT / ".github/workflows/weekly-digest.yml").read_text(encoding="utf-8")
        monthly = (ROOT / ".github/workflows/monthly-deepdive.yml").read_text(encoding="utf-8")
        self.assertIn("cron: '17 3 * * *'", daily)
        self.assertNotIn("0 6 * * *", daily)
        self.assertIn("cron: '0 5 * * 0'", weekly)
        self.assertIn("cron: '0 5 1 * *'", monthly)

    def test_pages_deploys_use_the_longer_timeout_and_a_retry(self) -> None:
        action = (ROOT / ".github/actions/deploy-pages-resilient/action.yml").read_text(encoding="utf-8")
        self.assertEqual(action.count('timeout: "1200000"'), 2)
        self.assertIn("Retry GitHub Pages deploy", action)
        self.assertNotIn('timeout: "600000"', action)
        for relative in (
            ".github/workflows/daily-content.yml",
            ".github/workflows/deploy.yml",
            ".github/workflows/weekly-digest.yml",
            ".github/workflows/monthly-deepdive.yml",
        ):
            text = (ROOT / relative).read_text(encoding="utf-8")
            self.assertIn("./.github/actions/deploy-pages-resilient", text, relative)
            self.assertNotIn("actions/deploy-pages@v4", text, relative)


if __name__ == "__main__":
    unittest.main(verbosity=2)
