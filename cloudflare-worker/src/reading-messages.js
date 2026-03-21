// Task 2: 鑑定フロー用 Flex Message

const COLOR_BG = '#1a1a2e';
const COLOR_GOLD = '#c9a84c';
const COLOR_LIGHT = '#e0e0e0';
const COLOR_MUTED = '#999999';

function makeBubble({ body, footer }) {
  const bubble = {
    type: 'bubble',
    styles: { body: { backgroundColor: COLOR_BG } },
    body,
  };
  if (footer) {
    bubble.styles.footer = { backgroundColor: COLOR_BG };
    bubble.footer = footer;
  }
  return bubble;
}

function goldButton(label, text) {
  return {
    type: 'button',
    style: 'link',
    color: COLOR_GOLD,
    action: { type: 'message', label, text },
    margin: 'md',
  };
}

// ① 紹介カード: 改行修正
export function buildReadingIntroCard(baseUrl) {
  const body = {
    type: 'box',
    layout: 'vertical',
    spacing: 'md',
    contents: [
      { type: 'text', text: '個別鑑定のご案内', weight: 'bold', color: COLOR_GOLD, size: 'xl' },
      {
        type: 'text',
        text: '西洋占星術 × 数秘術 × タロットの3軸で、あなただけの鑑定書をお作りします。',
        color: COLOR_LIGHT,
        size: 'sm',
        wrap: true,
      },
      { type: 'separator', color: COLOR_GOLD, margin: 'md' },
      { type: 'text', text: '📄 PDF鑑定書', color: COLOR_LIGHT, size: 'sm', margin: 'md' },
      { type: 'text', text: '🔮 3ヶ月タイムライン', color: COLOR_LIGHT, size: 'sm' },
      { type: 'text', text: '📅 好機日カレンダー付き', color: COLOR_LIGHT, size: 'sm' },
      { type: 'text', text: '⏰ 鑑定が終わり次第お届け', color: COLOR_MUTED, size: 'xs', margin: 'md' },
    ],
  };

  const footer = {
    type: 'box',
    layout: 'vertical',
    contents: [goldButton('鑑定を受ける', '鑑定を受ける')],
  };

  return makeBubble({ body, footer });
}

export function buildNamePrompt() {
  const body = {
    type: 'box',
    layout: 'vertical',
    spacing: 'md',
    contents: [
      { type: 'text', text: 'お名前を教えてください', weight: 'bold', color: COLOR_GOLD, size: 'lg' },
      {
        type: 'text',
        text: '鑑定書でお呼びするお名前（ニックネームOK）をメッセージで送ってください。',
        color: COLOR_LIGHT,
        size: 'sm',
        wrap: true,
      },
    ],
  };
  return makeBubble({ body });
}

// ②ボタンのテキストを日本語に（英語が見えない）
export function buildCategorySelect() {
  const body = {
    type: 'box',
    layout: 'vertical',
    spacing: 'none',
    contents: [
      { type: 'text', text: 'どのテーマを鑑定しますか？', weight: 'bold', color: COLOR_GOLD, size: 'lg', margin: 'md' },
      goldButton('恋愛・人間関係', '恋愛を選ぶ'),
      goldButton('仕事・キャリア', '仕事を選ぶ'),
    ],
  };
  return makeBubble({ body });
}

export function buildSubcategorySelect(categoryLabel, subcategories) {
  const buttons = subcategories.map(sub =>
    goldButton(sub.label, `${sub.label}を選ぶ`)
  );

  const body = {
    type: 'box',
    layout: 'vertical',
    spacing: 'none',
    contents: [
      { type: 'text', text: 'もう少し絞りましょう', weight: 'bold', color: COLOR_GOLD, size: 'lg', margin: 'md' },
      ...buttons,
    ],
  };
  return makeBubble({ body });
}

export function buildQ1(question) {
  const buttons = question.q1.options.map((opt, i) =>
    goldButton(opt, `回答:${i}`)
  );

  const body = {
    type: 'box',
    layout: 'vertical',
    spacing: 'none',
    contents: [
      { type: 'text', text: question.q1.label, weight: 'bold', color: COLOR_GOLD, size: 'md', wrap: true, margin: 'md' },
      ...buttons,
    ],
  };
  return makeBubble({ body });
}

export function buildQ2(question) {
  const body = {
    type: 'box',
    layout: 'vertical',
    spacing: 'sm',
    contents: [
      { type: 'text', text: question.q2.label, weight: 'bold', color: COLOR_GOLD, size: 'md', wrap: true },
      {
        type: 'text',
        text: '番号をカンマ区切りで送ってください（例: 1,3,5）',
        color: COLOR_MUTED,
        size: 'xs',
        wrap: true,
      },
      { type: 'separator', color: '#333344', margin: 'sm' },
      ...question.q2.options.map((opt, i) => ({
        type: 'text',
        text: `${i + 1}. ${opt}`,
        color: COLOR_LIGHT,
        size: 'sm',
        margin: 'sm',
      })),
    ],
  };
  return makeBubble({ body });
}

export function buildQ3(question) {
  const body = {
    type: 'box',
    layout: 'vertical',
    spacing: 'md',
    contents: [
      {
        type: 'text',
        text: '今の気持ちや状況をもう少し聞かせてください',
        weight: 'bold',
        color: COLOR_GOLD,
        size: 'md',
        wrap: true,
      },
      {
        type: 'text',
        text: question.q3.placeholder,
        color: COLOR_MUTED,
        size: 'xs',
        wrap: true,
      },
      {
        type: 'text',
        text: 'メッセージで送るか、下のボタンでスキップできます',
        color: COLOR_MUTED,
        size: 'xs',
        wrap: true,
        margin: 'md',
      },
    ],
  };

  const footer = {
    type: 'box',
    layout: 'vertical',
    contents: [goldButton('このまま鑑定する', 'このまま鑑定する')],
  };

  return makeBubble({ body, footer });
}

// ⑥ 受付完了カード: 待ち時間のメッセージを充実
export function buildReadingComplete(name, categoryLabel, subcategoryLabel) {
  const body = {
    type: 'box',
    layout: 'vertical',
    spacing: 'md',
    contents: [
      { type: 'text', text: '鑑定を受け付けました', weight: 'bold', color: COLOR_GOLD, size: 'lg' },
      { type: 'separator', color: COLOR_GOLD, margin: 'sm' },
      { type: 'text', text: `${name}さん`, color: COLOR_LIGHT, size: 'md', margin: 'md' },
      { type: 'text', text: `${categoryLabel} — ${subcategoryLabel}`, color: COLOR_MUTED, size: 'sm' },
      { type: 'separator', color: 'rgba(201,168,76,0.2)', margin: 'md' },
      {
        type: 'text',
        text: 'カイが星を読み、カードを引き、数字を紐解いています。鑑定が終わり次第お届けします。',
        color: COLOR_LIGHT,
        size: 'sm',
        wrap: true,
        margin: 'sm',
      },
      {
        type: 'text',
        text: '届くまでの間、今日の占いもぜひご覧ください✨',
        color: COLOR_MUTED,
        size: 'xs',
        wrap: true,
        margin: 'md',
      },
    ],
  };
  return makeBubble({ body });
}
