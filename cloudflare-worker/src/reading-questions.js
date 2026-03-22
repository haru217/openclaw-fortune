// 構造化質問データ（3カテゴリ10サブメニュー）

export const CATEGORIES = [
  { id: 'love', label: '恋愛のこと' },
  { id: 'relationship', label: '人間関係のこと' },
  { id: 'career', label: '仕事のこと' },
];

export const SUBCATEGORIES = {
  love: [
    { id: 'crush', label: '片思い・出会い' },
    { id: 'partner', label: 'パートナー・夫婦' },
    { id: 'marriage', label: '結婚・婚活' },
    { id: 'breakup', label: '復縁・別れ' },
  ],
  relationship: [
    { id: 'workplace', label: '職場の人' },
    { id: 'friends', label: '友人・知人' },
    { id: 'family', label: '家族・パートナー' },
  ],
  career: [
    { id: 'change', label: '転職・適職' },
    { id: 'current', label: '今の仕事の行方' },
    { id: 'restart', label: '復職・新しい働き方' },
  ],
};

export const QUESTIONS = {
  'love:crush': {
    q1: {
      label: '現在の状況を教えてください',
      options: ['気になる人がいる', '出会いがない', 'マッチングアプリ利用中', '告白を迷っている'],
    },
    q2: {
      label: '知りたいことは？（複数OK）',
      options: ['相手の気持ち', '出会いの時期', 'アプローチ方法', '相性', 'その他'],
      multi: true,
    },
    q3: { placeholder: '例: 職場で気になる人がいるけど、脈があるのか分からない' },
  },
  'love:partner': {
    q1: {
      label: '現在の状況を教えてください',
      options: ['安定している', 'マンネリを感じる', 'すれ違いが増えた', '結婚を考えている'],
    },
    q2: {
      label: '知りたいことは？（複数OK）',
      options: ['関係の行方', 'コミュニケーション改善', '結婚のタイミング', '相性の深堀り', 'その他'],
      multi: true,
    },
    q3: { placeholder: '例: 最近会話が減ってきて、このままでいいのか不安' },
  },
  'love:marriage': {
    q1: {
      label: '現在の状況を教えてください',
      options: ['相手がいて結婚を迷っている', 'プロポーズのタイミングを知りたい', '婚活中', '結婚願望はあるが相手がいない'],
    },
    q2: {
      label: '知りたいことは？（複数OK）',
      options: ['結婚のタイミング', '相手との相性', '出会いの時期', '決断の後押し', '注意すべきこと', 'その他'],
      multi: true,
    },
    q3: { placeholder: '例: 3年付き合っている彼がいるけど、この人でいいのか迷っている' },
  },
  'love:breakup': {
    q1: {
      label: '現在の状況を教えてください',
      options: ['別れたばかり', '復縁を迷っている', '別れを検討中', '連絡を取り合っている'],
    },
    q2: {
      label: '知りたいことは？（複数OK）',
      options: ['相手の気持ち', '復縁の可能性', '手放すべきか', '新しい出会いの時期', 'その他'],
      multi: true,
    },
    q3: { placeholder: '例: 半年前に別れたけど、まだ忘れられない' },
  },
  'relationship:workplace': {
    q1: {
      label: '現在の状況を教えてください',
      options: ['上司との関係', '同僚との関係', '部下との関係', 'チーム全体の雰囲気'],
    },
    q2: {
      label: '知りたいことは？（複数OK）',
      options: ['改善のヒント', '味方になる人', '距離の取り方', 'コミュニケーション方法', '転機の時期', 'その他'],
      multi: true,
    },
    q3: { placeholder: '例: 新しい上司と合わなくて、毎日がストレス' },
  },
  'relationship:friends': {
    q1: {
      label: '現在の状況を教えてください',
      options: ['特定の友人と距離を感じる', '人付き合いが苦手', 'グループ内の関係', '疎遠になった人がいる'],
    },
    q2: {
      label: '知りたいことは？（複数OK）',
      options: ['距離の取り方', '関係の修復', '新しい出会い', '自分の在り方', 'その他'],
      multi: true,
    },
    q3: { placeholder: '例: 長年の友人と価値観が合わなくなってきた' },
  },
  'relationship:family': {
    q1: {
      label: '現在の状況を教えてください',
      options: ['親との関係', '兄弟姉妹との関係', 'パートナーの家族', '家庭内の雰囲気'],
    },
    q2: {
      label: '知りたいことは？（複数OK）',
      options: ['距離感の取り方', '関係改善のヒント', '自分の気持ちの整理', '今後の展望', 'その他'],
      multi: true,
    },
    q3: { placeholder: '例: 母との距離感がうまく取れず、会うたびに疲れる' },
  },
  'career:change': {
    q1: {
      label: '現在の状況を教えてください',
      options: ['転職活動中', '内定済み・入社前', '転職を検討中', '今の仕事に不満がある'],
    },
    q2: {
      label: '知りたいことは？（複数OK）',
      options: ['タイミング', '向いている職種・業界', '人間関係', '成功のポイント', '注意すべきこと', 'その他'],
      multi: true,
    },
    q3: { placeholder: '例: 4月から新しい会社に入社します。期待もあるけど不安もあって…' },
  },
  'career:current': {
    q1: {
      label: '現在の状況を教えてください',
      options: ['順調', '停滞感がある', '異動・配置転換があった', '評価に不満がある'],
    },
    q2: {
      label: '知りたいことは？（複数OK）',
      options: ['今後の展望', '昇進・昇給', 'スキルアップの方向', '辞め時', '注意すべきこと', 'その他'],
      multi: true,
    },
    q3: { placeholder: '例: 3年目だけど成長を感じられない。このまま続けるべきか' },
  },
  'career:restart': {
    q1: {
      label: '現在の状況を教えてください',
      options: ['休職中', '離職中で復帰を考えている', '働き方を変えたい', '副業・独立を検討中'],
    },
    q2: {
      label: '知りたいことは？（複数OK）',
      options: ['復帰のタイミング', '向いている働き方', '不安の解消', '周囲との関係', '注意すべきこと', 'その他'],
      multi: true,
    },
    q3: { placeholder: '例: 育休明けで復帰するけど、前と同じように働ける自信がない' },
  },
};

export function getQuestion(categoryId, subcategoryId) {
  return QUESTIONS[`${categoryId}:${subcategoryId}`] || null;
}
