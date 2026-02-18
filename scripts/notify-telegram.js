#!/usr/bin/env node
/**
 * AI Trend Hub — Telegram Notification v1.0
 * Sends pipeline status notifications via Telegram Bot (openclaw Max)
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN - Bot token from @BotFather
 *   TELEGRAM_CHAT_ID   - Target chat/group ID
 *
 * Usage:
 *   node scripts/notify-telegram.js --status=success --pipeline=daily --details="5 articles collected"
 *   node scripts/notify-telegram.js --status=failure --pipeline=weekly --details="API error" --run-url="https://..."
 */

const https = require('https');

// ── Parse arguments ──
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const [key, ...vals] = arg.replace(/^--/, '').split('=');
    args[key] = vals.join('=');
  });
  return args;
}

// ── Send Telegram message ──
function sendTelegram(token, chatId, message) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Telegram API error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Build message ──
function buildMessage(args) {
  const status = args.status || 'unknown';
  const pipeline = args.pipeline || 'unknown';
  const details = args.details || '';
  const runUrl = args['run-url'] || '';

  const now = new Date();
  const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    .toISOString().replace('T', ' ').slice(0, 19);

  const pipelineNames = {
    daily: '📰 Daily Content Pipeline',
    weekly: '📊 Weekly Digest Pipeline',
    monthly: '📖 Monthly Deep Dive Pipeline',
    deploy: '🚀 Deploy Pipeline'
  };

  const pipelineName = pipelineNames[pipeline] || `🔧 ${pipeline}`;

  if (status === 'success') {
    let msg = `✅ <b>${pipelineName} 성공</b>\n`;
    msg += `⏰ ${kstTime} KST\n`;
    if (details) msg += `\n📋 ${details}`;
    msg += `\n\n🌐 <a href="https://suno7608.github.io/ai-trend-hub/">사이트 확인</a>`;
    if (runUrl) msg += ` | <a href="${runUrl}">실행 로그</a>`;
    return msg;
  }

  if (status === 'failure') {
    let msg = `🚨 <b>${pipelineName} 실패!</b>\n`;
    msg += `⏰ ${kstTime} KST\n`;
    if (details) msg += `\n❌ <b>오류:</b> ${details}`;
    if (runUrl) msg += `\n\n🔍 <a href="${runUrl}">실행 로그 확인</a>`;
    msg += `\n\n⚠️ 확인이 필요합니다.`;
    return msg;
  }

  // Generic
  let msg = `ℹ️ <b>${pipelineName}</b>\n`;
  msg += `⏰ ${kstTime} KST\n`;
  msg += `Status: ${status}\n`;
  if (details) msg += `\n${details}`;
  return msg;
}

// ── Main ──
async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('⚠️  TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set. Skipping notification.');
    process.exit(0);
  }

  const args = parseArgs();
  const message = buildMessage(args);

  try {
    await sendTelegram(token, chatId, message);
    console.log('✅ Telegram notification sent');
  } catch (error) {
    console.error(`⚠️  Failed to send Telegram notification: ${error.message}`);
    // Don't fail the pipeline just because notification failed
    process.exit(0);
  }
}

main();
