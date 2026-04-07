// GPT-5.4によるThreads投稿コンテンツ生成
import { promptA, promptB, promptC, promptD, promptE, promptF, EMPATHY_THEMES, TRIVIA_TOPICS } from './templates.js';

const OPENAI_API = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-5.4';

// OpenAI API呼び出し（JSON mode、500文字上限チェック付き）
async function callGPT({ prompt, apiKey, maxRetries = 2 }) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(OPENAI_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      if (attempt === maxRetries) {
        throw new Error(`OpenAI API failed: ${res.status} ${err}`);
      }
      await sleep(1000 * (attempt + 1));
      continue;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      if (attempt === maxRetries) throw new Error('OpenAI returned empty content');
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      if (attempt === maxRetries) throw new Error(`OpenAI returned invalid JSON: ${content}`);
      continue;
    }

    // 500文字上限チェック
    if (parsed.text && parsed.text.length > 500) {
      console.warn(`[content] Generated text exceeded 500 chars (${parsed.text.length}), retrying`);
      if (attempt === maxRetries) {
        // 最終試行でも超えていたら強制トリム
        parsed.text = parsed.text.slice(0, 497) + '...';
      } else {
        continue;
      }
    }

    return parsed;
  }
  throw new Error('Unreachable');
}

// ========================================
// 各フォーマットの生成関数
// ========================================

export async function generateA({ env, date, weekday, moonPhase, season }) {
  const prompt = promptA({ date, weekday, moonPhase, season });
  return callGPT({ prompt, apiKey: env.OPENAI_API_KEY });
}

export async function generateB({ env, weekStart, weekEnd, weekMoonEvents }) {
  const prompt = promptB({ weekStart, weekEnd, weekMoonEvents });
  return callGPT({ prompt, apiKey: env.OPENAI_API_KEY });
}

export async function generateC({ env, date, moonType, moonSign }) {
  const prompt = promptC({ date, moonType, moonSign });
  return callGPT({ prompt, apiKey: env.OPENAI_API_KEY });
}

export async function generateD({ env, month, remainingSlots, season }) {
  const prompt = promptD({ month, remainingSlots, season });
  return callGPT({ prompt, apiKey: env.OPENAI_API_KEY });
}

export async function generateE({ env, themeIndex }) {
  const theme = EMPATHY_THEMES[themeIndex % EMPATHY_THEMES.length];
  const prompt = promptE({ theme });
  return callGPT({ prompt, apiKey: env.OPENAI_API_KEY });
}

export async function generateF({ env, topicIndex }) {
  const topic = TRIVIA_TOPICS[topicIndex % TRIVIA_TOPICS.length];
  const prompt = promptF({ topic });
  return callGPT({ prompt, apiKey: env.OPENAI_API_KEY });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
