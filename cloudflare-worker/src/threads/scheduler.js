// 日時からどの投稿フォーマット(A-F)を打つか判定
// 新月・満月の日はAをCに差し替え、Dはステップ運用（M1:ゼロ/M2:隔週/M3+:週1）

// JSTへの変換
export function toJST(date) {
  // Cloudflare Workers は UTC。JST = UTC + 9h
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1,
    day: jst.getUTCDate(),
    weekday: jst.getUTCDay(), // 0=Sunday
    hour: jst.getUTCHours(),
    minute: jst.getUTCMinutes(),
  };
}

// 日付文字列（YYYY-MM-DD）を返す
export function jstDateString(date) {
  const { year, month, day } = toJST(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// 曜日名（日本語）
export function weekdayName(weekday) {
  return ['日', '月', '火', '水', '木', '金', '土'][weekday];
}

// 季節判定
export function getSeason(month) {
  if (month >= 3 && month <= 5) return '春';
  if (month >= 6 && month <= 8) return '夏';
  if (month >= 9 && month <= 11) return '秋';
  return '冬';
}

// プロジェクト開始月からの経過月数（ステップ運用判定用）
const PROJECT_START = { year: 2026, month: 4 }; // Threads開始月
export function monthsSinceStart(date) {
  const jst = toJST(date);
  return (jst.year - PROJECT_START.year) * 12 + (jst.month - PROJECT_START.month);
}

// ========================================
// ポスト種別判定（メインロジック）
// ========================================
// 返却: { type: 'A'|'B'|'C'|'D'|'E'|'F'|'SKIP', reason, meta }
export function decidePostType(date, moonData = null) {
  const jst = toJST(date);
  const { weekday, hour, minute } = jst;

  // 朝投稿帯（6:55-7:35 JST）
  if (hour === 6 || (hour === 7 && minute <= 35)) {
    // 新月/満月の日はC
    if (moonData && moonData.type && (moonData.type === 'new' || moonData.type === 'full')) {
      return {
        type: 'C',
        reason: `${moonData.type === 'new' ? '新月' : '満月'} in ${moonData.sign}`,
        meta: {
          date: jstDateString(date),
          moonType: moonData.type === 'new' ? '新月' : '満月',
          moonSign: moonData.sign,
        },
      };
    }
    // 月曜の7:25-7:35はB（週次テーマ）
    if (weekday === 1 && hour === 7 && minute >= 25) {
      return {
        type: 'B',
        reason: '月曜朝の週次テーマ',
        meta: computeWeekMeta(date),
      };
    }
    // 通常のA（朝ランキング）
    return {
      type: 'A',
      reason: '毎朝の運気ランキング',
      meta: {
        date: jstDateString(date),
        weekday: weekdayName(weekday),
        moonPhase: moonData?.phase ?? '通常',
        season: getSeason(jst.month),
      },
    };
  }

  // 土曜 10:55-11:05 JST はF（豆知識）
  if (weekday === 6 && hour === 11 && minute <= 5) {
    return {
      type: 'F',
      reason: '土曜の占い豆知識',
      meta: {
        topicIndex: Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000)), // 週ごとにローテ
      },
    };
  }

  // 火水木の20:55-21:05 JST はE（共感）
  if ([2, 3, 4].includes(weekday) && hour === 21 && minute <= 5) {
    return {
      type: 'E',
      reason: '平日夜の共感投稿',
      meta: {
        themeIndex: Math.floor(date.getTime() / (24 * 60 * 60 * 1000)), // 日ごとにローテ
      },
    };
  }

  // 日曜の19:55-20:05 JST はD（告知、ステップ運用）
  if (weekday === 0 && hour === 20 && minute <= 5) {
    const months = monthsSinceStart(date);

    // M1（開始月）は告知ゼロ
    if (months === 0) {
      return { type: 'SKIP', reason: 'M1は告知ゼロ運用' };
    }

    // M2は隔週（第2・第4日曜）
    if (months === 1) {
      const weekOfMonth = Math.ceil(jst.day / 7);
      if (weekOfMonth === 2 || weekOfMonth === 4) {
        return {
          type: 'D',
          reason: `M2 隔週告知（第${weekOfMonth}日曜）`,
          meta: computeDMeta(jst),
        };
      }
      return { type: 'SKIP', reason: 'M2 非告知日曜' };
    }

    // M3以降は毎週
    return {
      type: 'D',
      reason: 'M3+ 週次告知',
      meta: computeDMeta(jst),
    };
  }

  return { type: 'SKIP', reason: '投稿時間帯外' };
}

function computeWeekMeta(date) {
  const jst = toJST(date);
  // 月曜の日付を基準に、その週の終わり（日曜）までを算出
  const weekStart = `${jst.month}/${jst.day}`;
  const endDate = new Date(date.getTime() + 6 * 24 * 60 * 60 * 1000);
  const endJst = toJST(endDate);
  const weekEnd = `${endJst.month}/${endJst.day}`;
  return {
    weekStart,
    weekEnd,
    weekMoonEvents: '（別途moonDataから設定）',
  };
}

function computeDMeta(jst) {
  return {
    month: `${jst.month}月`,
    remainingSlots: '数名', // 実運用では KV の reading_req 集計から取る
    season: getSeason(jst.month),
  };
}
