// Task 1: 構造化質問データ（全12サブメニュー）

export const CATEGORIES = [
  { id: 'general', label: '総合鑑定' },
  { id: 'love', label: '恋愛・人間関係' },
  { id: 'career', label: '仕事・キャリア' },
  { id: 'destiny', label: '運命の転機' },
];

export const SUBCATEGORIES = {
  general: [
    { id: 'self', label: '自分を知る（性格・才能・傾向）' },
    { id: 'flow', label: '今後の運勢の流れ' },
    { id: 'direction', label: '人生の方向性' },
    { id: 'advice', label: '今の悩みへのアドバイス' },
  ],
  love: [
    { id: 'crush', label: '片思い・出会い' },
    { id: 'partner', label: 'パートナーとの関係' },
    { id: 'breakup', label: '復縁・別れ' },
  ],
  career: [
    { id: 'change', label: '転職・適職' },
    { id: 'current', label: '今の仕事の行方' },
    { id: 'people', label: '人間関係（職場）' },
  ],
  destiny: [
    { id: 'timing', label: '転機の時期' },
    { id: 'decision', label: '大きな決断の指針' },
    { id: 'mission', label: '人生の使命・テーマ' },
  ],
};

export const QUESTIONS = {
  'general:self': {
    q1: {
      label: 'きっかけを教えてください',
      options: ['自分の強みが分からない', '人間関係で悩むことが多い', '自分に自信が持てない', '新しい環境に入る前に知りたい'],
    },
    q2: {
      label: '特に知りたいことは？（複数OK）',
      options: ['性格の本質', '隠れた才能', '人間関係の傾向', '仕事の適性', '恋愛の傾向', 'その他'],
      multi: true,
    },
    q3: { placeholder: '例: 周りからどう見られているか気になる。自分では分からない部分を知りたい' },
  },
  'general:flow': {
    q1: {
      label: '特に気になる期間は？',
      options: ['直近1ヶ月', '3ヶ月先まで', '半年先まで', '1年の流れ', '2〜3年先まで'],
    },
    q2: {
      label: '知りたいことは？（複数OK）',
      options: ['仕事', '恋愛', '健康', '金運', '人間関係', '転機の時期', 'その他'],
      multi: true,
    },
    q3: { placeholder: '例: 最近なんとなく停滞感があって、いつ頃動き出すのか知りたい' },
  },
  'general:direction': {
    q1: {
      label: '今の状況を教えてください',
      options: ['岐路に立っている', '漠然とした不安', '新しいことを始めたい', '今の方向を確認したい'],
    },
    q2: {
      label: '知りたいことは？（複数OK）',
      options: ['適性・才能', '進むべき方向', '避けるべきこと', '転機の時期', 'その他'],
      multi: true,
    },
    q3: { placeholder: '例: 今の仕事を続けるべきか、全く違う道に進むべきか迷っている' },
  },
  'general:advice': {
    q1: {
      label: '悩みの領域は？',
      options: ['仕事', '恋愛・家庭', '人間関係', 'お金', '健康', '漠然とした不安'],
    },
    q2: {
      label: '今の気持ちは？（複数OK）',
      options: ['行き詰まっている', '決断できない', '疲れている', '前に進みたい', 'その他'],
      multi: true,
    },
    q3: { placeholder: '例: 何から手をつければいいか分からなくなっている' },
  },
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
  'destiny:timing': {
    q1: {
      label: '気になる分野は？',
      options: ['仕事', '恋愛', '引越し・生活環境', '人間関係', '全般'],
    },
    q2: {
      label: '知りたいことは？（複数OK）',
      options: ['いつ動くべきか', '準備すべきこと', 'チャンスの兆候', '注意すべきこと', 'その他'],
      multi: true,
    },
    q3: { placeholder: '例: 何か大きな変化が来そうな予感がしている' },
  },
  'destiny:decision': {
    q1: {
      label: '決断の種類は？',
      options: ['仕事', '引越し・移住', '結婚・離婚', '独立・起業', 'その他'],
    },
    q2: {
      label: '今の状態は？（複数OK）',
      options: ['迷っている', 'ほぼ決めたが不安', '周囲に反対されている', '期限が迫っている', 'その他'],
      multi: true,
    },
    q3: { placeholder: '例: 独立するか会社に残るか、年内に決めないといけない' },
  },
  'destiny:mission': {
    q1: {
      label: 'きっかけは？',
      options: ['自分の強みを知りたい', '生きがいを探している', '転換期を感じている', 'スピリチュアルに興味がある'],
    },
    q2: {
      label: '知りたいことは？（複数OK）',
      options: ['魂の目的', '今世のテーマ', '活かすべき才能', '乗り越えるべき課題', 'その他'],
      multi: true,
    },
    q3: { placeholder: '例: 自分が本当にやるべきことが何なのか、ずっと探している' },
  },
};

export function getQuestion(categoryId, subcategoryId) {
  return QUESTIONS[`${categoryId}:${subcategoryId}`] || null;
}
