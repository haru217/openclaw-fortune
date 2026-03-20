'use strict';

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '..', '.env') });

const path = require('node:path');
const express = require('express');
const { middleware, messagingApi } = require('@line/bot-sdk');

const { getZodiacSignFromBirthday } = require('../../lib/zodiac');
const { loadDailyFortune } = require('../../lib/daily-fortune');
const { getUser, saveUser } = require('../../lib/users');

const DAILY_DIR = path.join(__dirname, '..', '..', 'data', 'daily');
const USERS_PATH = path.join(__dirname, '..', '..', 'data', 'users.json');

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
};

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

const app = express();

// LINE webhook signature verification
app.post('/webhook', middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.json({ ok: true });
  } catch (err) {
    console.error('[webhook] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }

  const userId = event.source.userId;
  const text = event.message.text.trim();

  // Check if user is registered
  const user = getUser(USERS_PATH, userId);

  if (!user) {
    return handleRegistration(event, userId, text);
  }

  // Registered user — check for "今日の占い" trigger
  if (text === '今日の占い' || text === '占い') {
    return handleDailyFortune(event, user);
  }

  // Default: remind about rich menu
  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: 'text', text: 'リッチメニューの「今日の占い」をタップしてみてください🌙' }],
  });
}

async function handleRegistration(event, userId, text) {
  // Try to parse as birthday
  try {
    const result = getZodiacSignFromBirthday(text);
    saveUser(USERS_PATH, userId, { sign: result.id, birthday: result.birthday });

    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: 'text',
        text: `${result.name}ですね。登録しました✨\nリッチメニューから「今日の占い」をどうぞ🌙`,
      }],
    });
  } catch (_) {
    // Not a valid birthday — prompt for it
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: 'text',
        text: 'はじめまして、カイです🌙\n生年月日を教えてください（例: 1990/10/23）',
      }],
    });
  }
}

async function handleDailyFortune(event, user) {
  const today = new Date().toISOString().slice(0, 10);
  const data = loadDailyFortune(DAILY_DIR, today, { fallbackDays: 1 });

  if (!data || !data.fortunes[user.sign]) {
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: '本日の占いは準備中です。もう少しお待ちください🌙' }],
    });
  }

  const fortune = data.fortunes[user.sign];
  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: 'text', text: fortune.message }],
  });
}

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT}`);
});
