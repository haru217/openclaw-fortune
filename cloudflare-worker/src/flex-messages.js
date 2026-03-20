// Color palette
const COLOR_BG = '#1a1a2e';
const COLOR_GOLD = '#c9a84c';
const COLOR_LIGHT = '#e0e0e0';
const COLOR_MUTED = '#999999';

// Map tarot card id (0-21) to image filename
const TAROT_FILENAMES = [
  '00-fool.jpg',
  '01-magician.jpg',
  '02-high-priestess.jpg',
  '03-empress.jpg',
  '04-emperor.jpg',
  '05-hierophant.jpg',
  '06-lovers.jpg',
  '07-chariot.jpg',
  '08-strength.jpg',
  '09-hermit.jpg',
  '10-wheel-of-fortune.jpg',
  '11-justice.jpg',
  '12-hanged-man.jpg',
  '13-death.jpg',
  '14-temperance.jpg',
  '15-devil.jpg',
  '16-tower.jpg',
  '17-star.jpg',
  '18-moon.jpg',
  '19-sun.jpg',
  '20-judgement.jpg',
  '21-world.jpg',
];

/**
 * Returns the tarot image URL for a given card id.
 * @param {number} id - Card id (0-21)
 * @param {string} baseUrl
 * @returns {string}
 */
function tarotImageUrl(id, baseUrl) {
  const filename = TAROT_FILENAMES[id];
  if (!filename) throw new Error(`Unknown tarot card id: ${id}`);
  return `${baseUrl}/tarot/${filename}`;
}

/**
 * Shared bubble wrapper with dark navy background.
 * @param {object} opts - { hero?, body, footer? }
 * @returns {object} LINE Flex Message bubble
 */
function makeBubble({ hero, body, footer }) {
  const bubble = {
    type: 'bubble',
    styles: {
      hero: { backgroundColor: COLOR_BG },
      body: { backgroundColor: COLOR_BG },
      footer: { backgroundColor: COLOR_BG },
    },
  };
  if (hero) bubble.hero = hero;
  bubble.body = body;
  if (footer) bubble.footer = footer;
  return bubble;
}

/**
 * Welcome card: introduces カイ and asks for birthday.
 * @param {string} baseUrl
 * @returns {object} bubble
 */
function buildWelcomeCard(baseUrl) {
  const hero = {
    type: 'image',
    url: `${baseUrl}/welcome-hero.jpg`,
    size: 'full',
    aspectRatio: '20:13',
    aspectMode: 'cover',
  };

  const body = {
    type: 'box',
    layout: 'vertical',
    spacing: 'md',
    contents: [
      {
        type: 'text',
        text: 'はじめまして、カイです',
        weight: 'bold',
        color: COLOR_GOLD,
        size: 'xl',
        wrap: true,
      },
      {
        type: 'text',
        text: 'わたし、カイは西洋占星術とタロットで、あなたの毎日に星の導きをお届けします。',
        color: COLOR_LIGHT,
        size: 'sm',
        wrap: true,
      },
      {
        type: 'text',
        text: '最初に、あなたの生年月日を教えてください（例: 1990/01/15）。より精密な運勢をお伝えするために使います。',
        color: COLOR_MUTED,
        size: 'sm',
        wrap: true,
      },
    ],
  };

  const footer = {
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'text',
        text: '↑ 1990/01/15 のように入力してください',
        color: COLOR_MUTED,
        size: 'xs',
        align: 'center',
      },
    ],
  };

  return makeBubble({ hero, body, footer });
}

/**
 * Registration complete card: shows sign + first fortune + onboarding note.
 * @param {string} signName - e.g. '牡羊座'
 * @param {string} fortuneMessage
 * @param {string} baseUrl
 * @returns {object} bubble
 */
function buildRegistrationCompleteCard(signName, fortuneMessage, baseUrl) {
  const body = {
    type: 'box',
    layout: 'vertical',
    spacing: 'md',
    contents: [
      {
        type: 'text',
        text: '登録完了',
        weight: 'bold',
        color: COLOR_GOLD,
        size: 'lg',
      },
      {
        type: 'text',
        text: `あなたのサインは ${signName} です`,
        color: COLOR_LIGHT,
        size: 'md',
        wrap: true,
      },
      {
        type: 'separator',
        color: COLOR_GOLD,
        margin: 'md',
      },
      {
        type: 'text',
        text: fortuneMessage,
        color: COLOR_LIGHT,
        size: 'sm',
        wrap: true,
        margin: 'md',
      },
      {
        type: 'text',
        text: '毎日リッチメニューから無料で占いが見れます。ぜひ活用してください。',
        color: COLOR_MUTED,
        size: 'xs',
        wrap: true,
        margin: 'lg',
      },
    ],
  };

  return makeBubble({ body });
}

/**
 * Fortune card hero section with tarot image.
 * @param {object} fortune
 * @param {string} baseUrl
 * @returns {object} hero component
 */
function buildFortuneHero(fortune, baseUrl) {
  return {
    type: 'image',
    url: tarotImageUrl(fortune.card.id, baseUrl),
    size: 'full',
    aspectRatio: '20:13',
    aspectMode: 'cover',
  };
}

/**
 * Fortune card body contents (shared between fortune card and promo variant).
 * @param {object} fortune
 * @returns {Array} body content components
 */
function buildFortuneBodyContents(fortune) {
  const cardLabel = fortune.card.reversed
    ? `${fortune.card.name}（逆位置）`
    : fortune.card.name;

  return [
    {
      type: 'text',
      text: fortune.sign,
      weight: 'bold',
      color: COLOR_GOLD,
      size: 'xl',
    },
    {
      type: 'text',
      text: cardLabel,
      color: COLOR_MUTED,
      size: 'sm',
      margin: 'xs',
    },
    {
      type: 'separator',
      color: COLOR_GOLD,
      margin: 'md',
    },
    {
      type: 'text',
      text: fortune.message,
      color: COLOR_LIGHT,
      size: 'sm',
      wrap: true,
      margin: 'md',
    },
  ];
}

/**
 * Fortune card: tarot hero + daily message.
 * @param {object} fortune - { sign, message, lucky_item, card: { id, name, reversed } }
 * @param {string} baseUrl
 * @returns {object} bubble
 */
function buildFortuneCard(fortune, baseUrl) {
  const hero = buildFortuneHero(fortune, baseUrl);

  const body = {
    type: 'box',
    layout: 'vertical',
    spacing: 'sm',
    contents: buildFortuneBodyContents(fortune),
  };

  return makeBubble({ hero, body });
}

/**
 * Fortune card with subtle promo section at the bottom.
 * Extends buildFortuneCard with an individual reading CTA.
 * @param {object} fortune
 * @param {string} baseUrl
 * @returns {object} bubble
 */
function buildFortuneCardWithPromo(fortune, baseUrl) {
  const hero = buildFortuneHero(fortune, baseUrl);

  const promoContents = [
    {
      type: 'separator',
      color: COLOR_MUTED,
      margin: 'lg',
    },
    {
      type: 'text',
      text: 'もっと深くあなたの星を読み解きたい方へ',
      color: COLOR_MUTED,
      size: 'xs',
      wrap: true,
      margin: 'md',
    },
    {
      type: 'button',
      style: 'link',
      color: COLOR_GOLD,
      margin: 'sm',
      action: {
        type: 'message',
        label: '個別鑑定について見る →',
        text: '個別鑑定',
      },
    },
  ];

  const body = {
    type: 'box',
    layout: 'vertical',
    spacing: 'sm',
    contents: [
      ...buildFortuneBodyContents(fortune),
      ...promoContents,
    ],
  };

  return makeBubble({ hero, body });
}

/**
 * Paid reading info card: describes the service, price, and payment placeholder.
 * @returns {object} bubble
 */
function buildPaidReadingInfo() {
  const body = {
    type: 'box',
    layout: 'vertical',
    spacing: 'md',
    contents: [
      {
        type: 'text',
        text: '個別鑑定サービス',
        weight: 'bold',
        color: COLOR_GOLD,
        size: 'xl',
      },
      {
        type: 'text',
        text: '西洋占星術×数秘術×タロットの組み合わせで、あなただけの深い鑑定をお届けします。',
        color: COLOR_LIGHT,
        size: 'sm',
        wrap: true,
      },
      {
        type: 'separator',
        color: COLOR_GOLD,
        margin: 'md',
      },
      {
        type: 'box',
        layout: 'horizontal',
        margin: 'md',
        contents: [
          {
            type: 'text',
            text: '鑑定料金',
            color: COLOR_MUTED,
            size: 'sm',
            flex: 1,
          },
          {
            type: 'text',
            text: '2,000円',
            color: COLOR_GOLD,
            size: 'sm',
            weight: 'bold',
            align: 'end',
            flex: 1,
          },
        ],
      },
      {
        type: 'text',
        text: '決済リンクは準備中です。しばらくお待ちください。',
        color: COLOR_MUTED,
        size: 'xs',
        wrap: true,
        margin: 'lg',
      },
    ],
  };

  return makeBubble({ body });
}

export {
  buildWelcomeCard,
  buildRegistrationCompleteCard,
  buildFortuneCard,
  buildFortuneCardWithPromo,
  buildPaidReadingInfo,
};
