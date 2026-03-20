'use strict';

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '..', '.env') });

const path = require('node:path');
const express = require('express');
const { middleware, messagingApi } = require('@line/bot-sdk');

const { getZodiacSignFromBirthday } = require('../../lib/zodiac');
const { loadDailyFortune } = require('../../lib/daily-fortune');
const { getUser, saveUser, incrementViewCount } = require('../../lib/users');
const {
  buildWelcomeCard,
  buildRegistrationCompleteCard,
  buildFortuneCard,
  buildFortuneCardWithPromo,
  buildPaidReadingInfo,
} = require('../../lib/flex-messages');

const DAILY_DIR = path.join(__dirname, '..', '..', 'data', 'daily');
const USERS_PATH = path.join(__dirname, '..', '..', 'data', 'users.json');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

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
  if (event.type === 'follow') {
    return handleFollow(event);
  }
  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }
  const userId = event.source.userId;
  const text = event.message.text.trim();
  const user = getUser(USERS_PATH, userId);
  if (!user) {
    return handleRegistration(event, userId, text);
  }
  if (text === '今日の占い' || text === '占い') {
    return handleDailyFortune(event, userId, user);
  }
  if (text === '個別鑑定') {
    return handlePaidReading(event);
  }
  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: 'text', text: 'メニューの「今日の占い」からいつでも占いが見れます。ぜひどうぞ' }],
  });
}

async function handleFollow(event) {
  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'flex',
      altText: 'はじめまして、カイです。あなたの星を読みます。',
      contents: buildWelcomeCard(BASE_URL),
    }],
  });
}

async function handleRegistration(event, userId, text) {
  try {
    const result = getZodiacSignFromBirthday(text);
    saveUser(USERS_PATH, userId, { sign: result.id, birthday: result.birthday });
    const today = new Date().toISOString().slice(0, 10);
    const data = loadDailyFortune(DAILY_DIR, today, { fallbackDays: 1 });
    const fortune = data && data.fortunes[result.id];
    const fortuneText = fortune ? fortune.message : '明日から毎日の占いをお届けします。お楽しみに';
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: 'flex',
        altText: `${result.name}で登録しました。今日の占いをお届けします。`,
        contents: buildRegistrationCompleteCard(result.name, fortuneText, BASE_URL),
      }],
    });
  } catch (err) {
    console.error('[handleRegistration]', err.message);
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: 'flex',
        altText: 'カイです。生年月日を教えてください。',
        contents: buildWelcomeCard(BASE_URL),
      }],
    });
  }
}

async function handleDailyFortune(event, userId, user) {
  const today = new Date().toISOString().slice(0, 10);
  const data = loadDailyFortune(DAILY_DIR, today, { fallbackDays: 1 });
  if (!data || !data.fortunes[user.sign]) {
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: '本日の占いは準備中です。もう少しお待ちください' }],
    });
  }
  const fortune = data.fortunes[user.sign];
  const viewCount = incrementViewCount(USERS_PATH, userId);
  const isPromoTime = viewCount > 0 && viewCount % 3 === 0;
  const card = isPromoTime
    ? buildFortuneCardWithPromo(fortune, BASE_URL)
    : buildFortuneCard(fortune, BASE_URL);
  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'flex',
      altText: `${fortune.sign}の今日の占い`,
      contents: card,
    }],
  });
}

async function handlePaidReading(event) {
  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'flex',
      altText: '個別タロット鑑定のご案内',
      contents: buildPaidReadingInfo(),
    }],
  });
}

// Static assets (profile icon, tarot images)
app.use('/assets', express.static(path.join(__dirname, '..', '..', 'assets')));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT}`);
});
