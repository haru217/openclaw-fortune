'use strict';

const { getZodiacSignFromBirthday } = require('./zodiac.js');
const {
  getUser,
  saveUser,
  getDailyFortune,
  incrementViewCount,
} = require('./kv.js');
const {
  buildWelcomeCard,
  buildRegistrationCompleteCard,
  buildFortuneCard,
  buildFortuneCardWithPromo,
  buildPaidReadingInfo,
} = require('./flex-messages.js');

async function handleEvent(event, env) {
  const kv = env.FORTUNE_KV;
  const baseUrl = env.ASSETS_BASE_URL || '';

  if (event.type === 'follow') {
    return [
      {
        type: 'flex',
        altText: 'はじめまして、カイです。あなたの星を読みます。',
        contents: buildWelcomeCard(baseUrl),
      },
    ];
  }

  if (event.type !== 'message' || event.message.type !== 'text') {
    return [];
  }

  const userId = event.source.userId;
  const text = event.message.text.trim();
  const user = await getUser(kv, userId);

  if (!user) {
    return handleRegistration(kv, baseUrl, text, userId);
  }

  if (text === '今日の占い' || text === '占い') {
    return handleDailyFortune(kv, baseUrl, userId, user);
  }

  if (text === '個別鑑定') {
    return [
      {
        type: 'flex',
        altText: '個別タロット鑑定のご案内',
        contents: buildPaidReadingInfo(),
      },
    ];
  }

  return [
    {
      type: 'text',
      text: 'メニューの「今日の占い」からいつでも占いが見れます。ぜひどうぞ',
    },
  ];
}

async function handleRegistration(kv, baseUrl, text, userId) {
  try {
    const result = getZodiacSignFromBirthday(text);
    await saveUser(kv, userId, { sign: result.id, birthday: result.birthday });

    const today = new Date().toISOString().slice(0, 10);
    const data = await getDailyFortune(kv, today, { fallbackDays: 1 });
    const fortune = data && data.fortunes[result.id];
    const fortuneText = fortune
      ? fortune.message
      : '明日から毎日の占いをお届けします。お楽しみに';

    return [
      {
        type: 'flex',
        altText: `${result.name}で登録しました。今日の占いをお届けします。`,
        contents: buildRegistrationCompleteCard(result.name, fortuneText, baseUrl),
      },
    ];
  } catch (error) {
    console.error('[handleRegistration]', error.message);
    return [
      {
        type: 'flex',
        altText: 'カイです。生年月日を教えてください。',
        contents: buildWelcomeCard(baseUrl),
      },
    ];
  }
}

async function handleDailyFortune(kv, baseUrl, userId, user) {
  const today = new Date().toISOString().slice(0, 10);
  const data = await getDailyFortune(kv, today, { fallbackDays: 1 });

  if (!data || !data.fortunes[user.sign]) {
    return [{ type: 'text', text: '本日の占いは準備中です。もう少しお待ちください' }];
  }

  const fortune = data.fortunes[user.sign];
  const viewCount = await incrementViewCount(kv, userId);
  const isPromoTime = viewCount > 0 && viewCount % 3 === 0;
  const card = isPromoTime
    ? buildFortuneCardWithPromo(fortune, baseUrl)
    : buildFortuneCard(fortune, baseUrl);

  return [
    {
      type: 'flex',
      altText: `${fortune.sign}の今日の占い`,
      contents: card,
    },
  ];
}

module.exports = { handleEvent };
