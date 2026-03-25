// 鑑定フロー用 Flex Message（v5: Q1→Q2→Q3自由記述）

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

export function buildCategorySelect() {
  const body = {
    type: 'box',
    layout: 'vertical',
    spacing: 'none',
    contents: [
      { type: 'text', text: 'どのテーマを鑑定しますか？', weight: 'bold', color: COLOR_GOLD, size: 'lg', margin: 'md' },
      goldButton('恋愛のこと', '恋愛を選ぶ'),
      goldButton('家族・友人のこと', '家族・友人を選ぶ'),
      goldButton('仕事のこと', '仕事を選ぶ'),
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
      goldButton('← テーマ選びに戻る', 'テーマに戻る'),
    ],
  };
  return makeBubble({ body });
}

export function buildQ1(question) {
  const buttons = question.q1.options.map(opt =>
    goldButton(opt, opt)
  );

  const body = {
    type: 'box',
    layout: 'vertical',
    spacing: 'none',
    contents: [
      { type: 'text', text: question.q1.label, weight: 'bold', color: COLOR_GOLD, size: 'md', wrap: true, margin: 'md' },
      ...buttons,
      goldButton('← 戻る', '戻る'),
    ],
  };
  return makeBubble({ body });
}

export function buildQ2(q2Data) {
  const buttons = q2Data.options.map(opt =>
    goldButton(opt, opt)
  );

  const body = {
    type: 'box',
    layout: 'vertical',
    spacing: 'none',
    contents: [
      { type: 'text', text: q2Data.label, weight: 'bold', color: COLOR_GOLD, size: 'md', wrap: true, margin: 'md' },
      ...buttons,
      goldButton('← 戻る', '戻る'),
    ],
  };
  return makeBubble({ body });
}

export function buildQ3(q3Data) {
  const body = {
    type: 'box',
    layout: 'vertical',
    spacing: 'md',
    contents: [
      {
        type: 'text',
        text: 'いま困っていることを自由に書いてください',
        weight: 'bold',
        color: COLOR_GOLD,
        size: 'md',
        wrap: true,
      },
      {
        type: 'text',
        text: `書き方のヒント：${q3Data.hint}`,
        color: COLOR_MUTED,
        size: 'xs',
        wrap: true,
      },
      {
        type: 'text',
        text: 'メッセージで送ってください',
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
    contents: [
      goldButton('← 戻る', '戻る'),
    ],
  };

  return makeBubble({ body, footer });
}

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
      { type: 'separator', color: '#3d3a2e', margin: 'md' },
      {
        type: 'text',
        text: '星を読み、カードを引き、数字を紐解いています。鑑定が終わり次第お届けします。',
        color: COLOR_LIGHT,
        size: 'sm',
        wrap: true,
        margin: 'sm',
      },
      {
        type: 'text',
        text: '届くまでの間、今日の占いもぜひご覧ください',
        color: COLOR_MUTED,
        size: 'xs',
        wrap: true,
        margin: 'md',
      },
    ],
  };
  return makeBubble({ body });
}

export function buildReadingDelivery(name, categoryLabel, subcategoryLabel, pdfUrl) {
  const body = {
    type: 'box',
    layout: 'vertical',
    spacing: 'md',
    contents: [
      { type: 'text', text: '鑑定書が届きました', weight: 'bold', color: COLOR_GOLD, size: 'xl' },
      { type: 'separator', color: COLOR_GOLD, margin: 'sm' },
      { type: 'text', text: `${name}さん`, color: COLOR_LIGHT, size: 'md', margin: 'md' },
      { type: 'text', text: `${categoryLabel} — ${subcategoryLabel}`, color: COLOR_MUTED, size: 'sm' },
      { type: 'separator', color: '#3d3a2e', margin: 'md' },
      {
        type: 'text',
        text: '星を読み、カードを引き、数字を紐解きました。あなただけの鑑定書をお届けします。',
        color: COLOR_LIGHT,
        size: 'sm',
        wrap: true,
        margin: 'sm',
      },
    ],
  };

  const footer = {
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'button',
        style: 'link',
        color: COLOR_GOLD,
        action: { type: 'uri', label: '鑑定書を見る', uri: pdfUrl },
        margin: 'md',
      },
    ],
  };

  return makeBubble({ body, footer });
}
