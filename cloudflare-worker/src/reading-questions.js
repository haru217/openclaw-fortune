// Task 1: 構造化質問データ（全12サブメニュー）

export const CATEGORIES = [
  { id: 'love', label: '恋愛・人間関係' },
  { id: 'career', label: '仕事・キャリア' },
];

export const SUBCATEGORIES = {
  love: [
    { id: 'crush', label: '片思い・出会い' },
    { id: 'partner', label: 'パートナーとの関係' },
    { id: 'marriage', label: '結婚・婚活' },
    { id: 'breakup', label: '復縁・別れ' },
  ],
  career: [
    { id: 'change', label: '転職・適職' },
    { id: 'current', label: '今の仕事の行方' },
    { id: 'people', label: '人間関係（職場）' },
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
  'career:people': {
    q1: {
      label: '現在の状況を教えてください',
      options: ['上司との関係', '同僚との関係', '部下との関係', 'チーム全体の雰囲気'],
    },
    q2: {
      label: '知りたいことは？（複数OK）',
      options: ['改善のヒント', '味方になる人', '距離を置くべき人', 'コミュニケーション方法', '転機の時期', 'その他'],
      multi: true,
    },
    q3: { placeholder: '例: 新しい上司と合わなくて、毎日がストレス' },
  },
};

export function getQuestion(categoryId, subcategoryId) {
  return QUESTIONS[`${categoryId}:${subcategoryId}`] || null;
}
