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

// カテゴリ×カード相性フィルター（重み付きランダム）
const CARD_WEIGHTS = {
  'love:start':    { 0:3, 6:3, 8:2, 17:3, 18:2, 19:2 },
  'love:partner':  { 3:2, 6:3, 8:3, 11:2, 14:3, 21:2 },
  'love:reunion':  { 4:3, 8:2, 12:3, 14:2, 17:2, 18:3, 20:3 },
  'relation:family': { 4:2, 8:3, 9:2, 11:3, 14:3, 20:2 },
  'relation:friend': { 8:3, 9:3, 11:2, 14:3, 17:2 },
  'work:career':   { 1:3, 3:2, 4:2, 7:3, 10:3, 21:2 },
  'work:people':   { 8:3, 9:2, 11:3, 14:3, 17:2, 20:2 },
};
function weightedTarotDraw(category, subcategory) {
  const key = `${category}:${subcategory}`;
  const weights = CARD_WEIGHTS[key] || {};
  const pool = [];
  for (let i = 0; i < 22; i++) {
    const w = weights[i] || 1;
    for (let j = 0; j < w; j++) pool.push(i);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

async function handleEvent(event, env, ctx) {
  const kv = env.FORTUNE_KV;
  const baseUrl = env.ASSETS_BASE_URL || '';

  if (event.type === 'follow') {
    return [{
      type: 'flex',
      altText: 'はじめまして、カイです。あなたの星を読みます。',
      contents: buildWelcomeCard(baseUrl),
    }];
  }

  // Postbackイベント（リッチメニューやボタンからのdata送信）をtext相当として扱う
  // action.data の形式: "text=鑑定を受ける" or 単に "鑑定を受ける"
  let userId;
  let text;
  if (event.type === 'postback') {
    if (!event.source || !event.source.userId || !event.postback) return [];
    userId = event.source.userId;
    const data = event.postback.data || '';
    const textMatch = data.match(/^text=(.+)$/);
    text = textMatch ? textMatch[1] : data;
    text = text.trim();
  } else if (event.type === 'message' && event.message.type === 'text') {
    userId = event.source.userId;
    text = event.message.text.trim();
  } else {
    return [];
  }
  const user = await getUser(kv, userId);

  if (!user) {
    return handleRegistration(kv, baseUrl, text, userId);
  }

  // 鑑定フローの状態チェック
  const readingState = await getReadingState(kv, userId);
  if (readingState) {
    return handleReadingFlow(kv, baseUrl, userId, user, text, readingState, ctx);
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

async function handleReadingFlow(kv, baseUrl, userId, user, text, state, ctx) {
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
    const question = getQuestion(state.category, state.subcategory);
    const answer = question && question.q1.options.find(opt => opt === text);
    if (!answer) {
      return [{
        type: 'flex',
        altText: '選択してください',
        contents: buildQ1(question),
      }];
    }
    const q2Data = question.q2[answer];
    await setReadingState(kv, userId, { step: 'awaiting_q2', q1: answer });
    return [{
      type: 'flex',
      altText: q2Data.label,
      contents: buildQ2(q2Data),
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
    const question = getQuestion(state.category, state.subcategory);
    const q2Data = question.q2[state.q1];
    const answer = q2Data && q2Data.options.find(opt => opt === text);
    if (!answer) {
      return [{
        type: 'flex',
        altText: '選択してください',
        contents: buildQ2(q2Data),
      }];
    }
    // 独立・副業の特殊フロー: Q2→Q3(選択)→Q4(自由記述)
    if (q2Data.next && q2Data.next[answer]) {
      const q3Data = q2Data.next[answer];
      await setReadingState(kv, userId, { step: 'awaiting_q3_select', q2: answer });
      return [{
        type: 'flex',
        altText: q3Data.label,
        contents: buildQ2(q3Data),
      }];
    }
    // 感情トーン質問がある場合: Q2→emotion→Q3(自由記述)
    if (question.emotion) {
      await setReadingState(kv, userId, { step: 'awaiting_emotion', q2: answer });
      return [{
        type: 'flex',
        altText: question.emotion.label,
        contents: buildQ2(question.emotion),
      }];
    }
    // 通常フロー: Q2→Q3(自由記述)
    const q3Hint = question.q3[state.q1];
    await setReadingState(kv, userId, { step: 'awaiting_q3', q2: answer });
    return [{
      type: 'flex',
      altText: 'いま困っていることを教えてください',
      contents: buildQ3(q3Hint),
    }];
  }

  // awaiting_emotion（感情トーン選択: work:people等）
  if (step === 'awaiting_emotion') {
    if (text === '戻る') {
      const question = getQuestion(state.category, state.subcategory);
      const q2Data = question.q2[state.q1];
      await setReadingState(kv, userId, { step: 'awaiting_q2', q1: state.q1 });
      return [{
        type: 'flex',
        altText: q2Data.label,
        contents: buildQ2(q2Data),
      }];
    }
    const question = getQuestion(state.category, state.subcategory);
    const answer = question.emotion.options.find(opt => opt === text);
    if (!answer) {
      return [{
        type: 'flex',
        altText: question.emotion.label,
        contents: buildQ2(question.emotion),
      }];
    }
    const q3Hint = question.q3[state.q1];
    await setReadingState(kv, userId, { step: 'awaiting_q3', emotion: answer });
    return [{
      type: 'flex',
      altText: 'いま困っていることを教えてください',
      contents: buildQ3(q3Hint),
    }];
  }

  // awaiting_q3_select（独立・副業の追加ステップ: 選択式Q3）
  if (step === 'awaiting_q3_select') {
    if (text === '戻る') {
      const question = getQuestion(state.category, state.subcategory);
      const q2Data = question.q2[state.q1];
      await setReadingState(kv, userId, { step: 'awaiting_q2', q1: state.q1 });
      return [{
        type: 'flex',
        altText: q2Data.label,
        contents: buildQ2(q2Data),
      }];
    }
    const question = getQuestion(state.category, state.subcategory);
    const q2Data = question.q2[state.q1];
    const q3Data = q2Data.next[state.q2];
    const answer = q3Data && q3Data.options.find(opt => opt === text);
    if (!answer) {
      return [{
        type: 'flex',
        altText: '選択してください',
        contents: buildQ2(q3Data),
      }];
    }
    await setReadingState(kv, userId, { step: 'awaiting_q3', q2: `${state.q2} → ${answer}` });
    return [{
      type: 'flex',
      altText: 'いま困っていることを教えてください',
      contents: buildQ3({ hint: q3Data.hint }),
    }];
  }

  // awaiting_q3（自由記述）
  if (step === 'awaiting_q3') {
    if (text === '戻る') {
      const question = getQuestion(state.category, state.subcategory);
      const q2Data = question.q2[state.q1];
      // 独立・副業の場合はQ3選択に戻る
      if (q2Data.next) {
        const q2Answer = state.q2.split(' → ')[0];
        const q3Data = q2Data.next[q2Answer];
        await setReadingState(kv, userId, { step: 'awaiting_q3_select', q2: q2Answer });
        return [{
          type: 'flex',
          altText: q3Data.label,
          contents: buildQ2(q3Data),
        }];
      }
      // 感情トーンがある場合はemotionに戻る
      if (question.emotion && state.emotion) {
        await setReadingState(kv, userId, { step: 'awaiting_emotion', q2: state.q2 });
        return [{
          type: 'flex',
          altText: question.emotion.label,
          contents: buildQ2(question.emotion),
        }];
      }
      await setReadingState(kv, userId, { step: 'awaiting_q2', q1: state.q1 });
      return [{
        type: 'flex',
        altText: q2Data.label,
        contents: buildQ2(q2Data),
      }];
    }
    if (text.length > 500) {
      return [{ type: 'text', text: '500文字以内でお願いします🙏' }];
    }
    const q3 = text;
    const cardId = weightedTarotDraw(state.category, state.subcategory);
    const reversed = Math.random() < 0.3;

    if (ctx) {
      ctx.waitUntil((async () => {
        await clearReadingState(kv, userId);
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
          emotion: state.emotion || '',
          q3,
          tarotCard: { id: cardId, reversed },
        });
        console.log('[reading] Request saved:', request.id);
      })());
    }

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
