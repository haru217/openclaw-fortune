// 画像URL解決と月齢データのロード
// 画像は GitHub raw にホストする前提（既存 ASSETS_BASE_URL パターンに合わせる）

const ZODIAC_NAME_TO_SLUG = {
  '牡羊座': 'aries',
  '牡牛座': 'taurus',
  '双子座': 'gemini',
  '蟹座': 'cancer',
  '獅子座': 'leo',
  '乙女座': 'virgo',
  '天秤座': 'libra',
  '蠍座': 'scorpio',
  '射手座': 'sagittarius',
  '山羊座': 'capricorn',
  '水瓶座': 'aquarius',
  '魚座': 'pisces',
};

// Aタイプ（朝ランキング）はトップ星座の画像、Cタイプは月相画像
export function resolveImageUrl(decision, content, env) {
  const base = env.ASSETS_BASE_URL || 'https://raw.githubusercontent.com/haru217/openclaw-fortune/master/assets';

  if (decision.type === 'A' && content.top_sign) {
    const slug = ZODIAC_NAME_TO_SLUG[content.top_sign];
    if (slug) {
      return `${base}/threads/zodiac/${slug}.jpg`;
    }
  }

  if (decision.type === 'C' && decision.meta.moonType) {
    const phase = decision.meta.moonType === '新月' ? 'new_moon' : 'full_moon';
    const signSlug = ZODIAC_NAME_TO_SLUG[decision.meta.moonSign] || 'generic';
    return `${base}/threads/moon/${phase}_${signSlug}.jpg`;
  }

  // B, D, E, Fはテキストのみ
  return null;
}

// 月齢データをKVから読む（事前に投入されている想定）
// キー: threads:moon_calendar:YYYY
// 値: { "YYYY-MM-DD": { type: "new"|"full", sign: "牡羊座" } }
export async function loadMoonData(kv, date) {
  const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = jstDate.getUTCFullYear();
  const dateKey = jstDate.toISOString().slice(0, 10);

  const calendar = await kv.get(`threads:moon_calendar:${year}`, { type: 'json' });
  if (!calendar || !calendar[dateKey]) {
    return { type: null, sign: null, phase: '通常' };
  }

  return {
    type: calendar[dateKey].type, // "new" | "full"
    sign: calendar[dateKey].sign,
    phase: calendar[dateKey].type === 'new' ? '新月' : calendar[dateKey].type === 'full' ? '満月' : '通常',
  };
}
