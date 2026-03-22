import { getZodiacSignFromBirthday } from './zodiac.js';
import {
  getUser,
  saveUser,
  getDailyFortune,
  incrementViewCount,
} from './kv.js';
import {
  buildWelcomeCard,
  buildRegistrationCompleteCard,
  buildFortuneCard,
  buildFortuneCardWithPromo,
} from './flex-messages.js';
import { getReadingState, setReadingState, clearReadingState } from './reading-state.js';
import { CATEGORIES, SUBCATEGORIES, getQuestion } from './reading-questions.js';
import {
  buildReadingIntroCard,
  buildNamePrompt,
  buildCategorySelect,
  buildSubcategorySelect,
  buildQ1,
  buildQ2,
  buildQ3,
  buildReadingComplete,
} from './reading-messages.js';
import { saveReadingRequest } from './reading-request.js';

// ② ボタンテキスト→IDのマッピング（英語を見せない）
const CATEGORY_MAP = {
  '恋愛を選ぶ': 'love',
  '家族・友人を選ぶ': 'relation',
  '仕事を選ぶ': 'work',
};

function buildSubcategoryMap(categoryId) {
  const subs = SUBCATEGORIES[categoryId] || [];
  const map = {};
  for (const sub of subs) {
    map[`${sub.label}を選ぶ`] = sub;
  }
  return map;
}

async function handleEvent(event, env) {
  const kv = env.FORTUNE_KV;
  const baseUrl = env.ASSETS_BASE_URL || '';

  if (event.type === 'follow') {
    return [{
      type: 'flex',
      altText: 'はじめまして、カイです。あなたの星を読みます。',
      contents: buildWelcomeCard(baseUrl),
    }];
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

  // 鑑定フローの状態チェック
  const readingState = await getReadingState(kv, userId);
  if (readingState) {
    return handleReadingFlow(kv, baseUrl, userId, user, text, readingState);
  }

  if (text === '個別鑑定') {
    return [{
      type: 'flex',
      altText: '個別鑑定のご案内',
      contents: buildReadingIntroCard(baseUrl),
    }];
  }

  if (text === '鑑定を受ける') {
    await setReadingState(kv, userId, { step: 'awaiting_name' });
    return [{
      type: 'flex',
      altText: 'お名前を教えてください',
      contents: buildNamePrompt(),
    }];
  }

  if (text === '今日の占い' || text === '占い') {
    return handleDailyFortune(kv, baseUrl, userId, user);
  }

  return [{
    type: 'text',
    text: 'メニューの「今日の占い」からいつでも占いが見れます。ぜひどうぞ',
  }];
}

async function handleReadingFlow(kv, baseUrl, userId, user, text, state) {
  const { step } = state;

  // awaiting_name
  if (step === 'awaiting_name') {
    if (text.length > 20) {
      return [{ type: 'text', text: '20文字以内でお願いします🙏' }];
    }
    await setReadingState(kv, userId, { step: 'awaiting_category', name: text });
    return [{
      type: 'flex',
      altText: 'どのテーマを鑑定しますか？',
      contents: buildCategorySelect(),
    }];
  }

  // awaiting_category
  if (step === 'awaiting_category') {
    const categoryId = CATEGORY_MAP[text];
    if (!categoryId) {
      return [{
        type: 'flex',
        altText: 'テーマを選んでください',
        contents: buildCategorySelect(),
      }];
    }
    const category = CATEGORIES.find(c => c.id === categoryId);
    const subs = SUBCATEGORIES[categoryId];
    await setReadingState(kv, userId, {
      step: 'awaiting_subcategory',
      category: categoryId,
      categoryLabel: category.label,
    });
    return [{
      type: 'flex',
      altText: 'もう少し絞りましょう',
      contents: buildSubcategorySelect(category.label, subs),
    }];
  }

  // awaiting_subcategory
  if (step === 'awaiting_subcategory') {
    if (text === 'テーマに戻る') {
      await setReadingState(kv, userId, { step: 'awaiting_category', name: state.name });
      return [{
        type: 'flex',
        altText: 'どのテーマを鑑定しますか？',
        contents: buildCategorySelect(),
      }];
    }
    const subMap = buildSubcategoryMap(state.category);
    const sub = subMap[text];
    if (!sub) {
      const subs = SUBCATEGORIES[state.category];
      const category = CATEGORIES.find(c => c.id === state.category);
      return [{
        type: 'flex',
        altText: 'メニューを選んでください',
        contents: buildSubcategorySelect(category.label, subs),
      }];
    }
    const question = getQuestion(state.category, sub.id);
    await setReadingState(kv, userId, {
      step: 'awaiting_q1',
      subcategory: sub.id,
      subcategoryLabel: sub.label,
    });
    return [{
      type: 'flex',
      altText: question.q1.label,
      contents: buildQ1(question),
    }];
  }

  // awaiting_q1
  if (step === 'awaiting_q1') {
    if (text === '戻る') {
      const category = CATEGORIES.find(c => c.id === state.category);
      const subs = SUBCATEGORIES[state.category];
      await setReadingState(kv, userId, { step: 'awaiting_subcategory', name: state.name, category: state.category, categoryLabel: state.categoryLabel });
      return [{
        type: 'flex',
        altText: 'もう少し絞りましょう',
        contents: buildSubcategorySelect(category.label, subs),
      }];
    }
    const match = text.match(/^回答:(\d+)$/);
    const question = getQuestion(state.category, state.subcategory);
    if (!match || !question) {
      return [{
        type: 'flex',
        altText: '選択してください',
        contents: buildQ1(question),
      }];
    }
    const idx = parseInt(match[1], 10);
    const answer = question.q1.options[idx];
    if (!answer) {
      return [{
        type: 'flex',
        altText: '選択してください',
        contents: buildQ1(question),
      }];
    }
    await setReadingState(kv, userId, { step: 'awaiting_q2', q1: answer });
    return [{
      type: 'flex',
      altText: question.q2.label,
      contents: buildQ2(question),
    }];
  }

  // awaiting_q2
  if (step === 'awaiting_q2') {
    if (text === '戻る') {
      const question = getQuestion(state.category, state.subcategory);
      await setReadingState(kv, userId, { step: 'awaiting_q1', subcategory: state.subcategory, subcategoryLabel: state.subcategoryLabel });
      return [{
        type: 'flex',
        altText: question.q1.label,
        contents: buildQ1(question),
      }];
    }
    const match = text.match(/^q2回答:(\d+)$/);
    const question = getQuestion(state.category, state.subcategory);
    if (!match || !question) {
      return [{
        type: 'flex',
        altText: '選択してください',
        contents: buildQ2(question),
      }];
    }
    const idx = parseInt(match[1], 10);
    const answer = question.q2.options[idx];
    if (!answer) {
      return [{
        type: 'flex',
        altText: '選択してください',
        contents: buildQ2(question),
      }];
    }
    await setReadingState(kv, userId, { step: 'awaiting_q3', q2: answer });
    return [{
      type: 'flex',
      altText: 'いま困っていることを教えてください',
      contents: buildQ3(question),
    }];
  }

  // awaiting_q3
  if (step === 'awaiting_q3') {
    if (text === '戻る') {
      const question = getQuestion(state.category, state.subcategory);
      await setReadingState(kv, userId, { step: 'awaiting_q2', q1: state.q1 });
      return [{
        type: 'flex',
        altText: question.q2.label,
        contents: buildQ2(question),
      }];
    }
    const q3 = text === 'このまま鑑定する' ? '' : text;
    await clearReadingState(kv, userId);

    const cardId = Math.floor(Math.random() * 22);
    const reversed = Math.random() < 0.3;

    const request = await saveReadingRequest(kv, {
      userId,
      name: state.name,
      birthday: user.birthday,
      sign: user.sign,
      category: state.category,
      subcategory: state.subcategory,
      categoryLabel: state.categoryLabel,
      subcategoryLabel: state.subcategoryLabel,
      q1: state.q1,
      q2: state.q2,
      q3,
      tarotCard: { id: cardId, reversed },
    });

    console.log('[reading] Request saved:', request.id);

    return [{
      type: 'flex',
      altText: '鑑定を受け付けました',
      contents: buildReadingComplete(state.name, state.categoryLabel, state.subcategoryLabel),
    }];
  }

  await clearReadingState(kv, userId);
  return [{ type: 'text', text: 'もう一度「個別鑑定」からお試しください' }];
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

    return [{
      type: 'flex',
      altText: `${result.name}で登録しました。今日の占いをお届けします。`,
      contents: buildRegistrationCompleteCard(result.name, fortuneText, baseUrl),
    }];
  } catch (error) {
    console.error('[handleRegistration]', error.message);
    return [{
      type: 'flex',
      altText: 'カイです。生年月日を教えてください。',
      contents: buildWelcomeCard(baseUrl),
    }];
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

  return [{
    type: 'flex',
    altText: `${fortune.sign}の今日の占い`,
    contents: card,
  }];
}

export { handleEvent };
