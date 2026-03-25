'use strict';

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '..', '.env') });

const fs = require('node:fs');
const path = require('node:path');
const { lifePathNumber, personalYear, personalMonth } = require('../../lib/numerology');
const { ZODIAC_SIGNS } = require('../../lib/zodiac');
const { execSync, spawnSync } = require('node:child_process');
const os = require('node:os');

const TEMPLATE_DIR = path.join(__dirname, '..', '..', 'data', 'templates');
const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets');
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'data', 'readings');
const MOON_PHASES_PATH = path.join(__dirname, '..', '..', 'data', 'moon-phases-2026.json');
const EPHEMERIS_PATH = path.join(__dirname, '..', '..', 'data', 'ephemeris-2026.json');
const TAROT_NAMES = [
  '愚者','魔術師','女教皇','女帝','皇帝','教皇','恋人たち',
  '戦車','力','隠者','運命の輪','正義','吊るされた男','死神',
  '節制','悪魔','塔','星','月','太陽','審判','世界',
];
const TAROT_FILENAMES = [
  '00-fool.jpg','01-magician.jpg','02-high-priestess.jpg','03-empress.jpg',
  '04-emperor.jpg','05-hierophant.jpg','06-lovers.jpg','07-chariot.jpg',
  '08-strength.jpg','09-hermit.jpg','10-wheel-of-fortune.jpg','11-justice.jpg',
  '12-hanged-man.jpg','13-death.jpg','14-temperance.jpg','15-devil.jpg',
  '16-tower.jpg','17-star.jpg','18-moon.jpg','19-sun.jpg',
  '20-judgement.jpg','21-world.jpg',
];

const TAROT_MEANINGS = {
  '愚者': { upright: '新しい始まり・自由・可能性・直感を信じる旅立ち', reversed: '無計画・不注意・リスクの軽視' },
  '魔術師': { upright: '才能の開花・意志の力・創造性・チャンスを形にする', reversed: '才能の空回り・自信過剰・詐欺的' },
  '女教皇': { upright: '直感・内なる知恵・静けさの中の答え・潜在意識', reversed: '直感の無視・表面的な判断・秘密' },
  '女帝': { upright: '豊かさ・母性・創造力・実りの時期', reversed: '過保護・依存・創造力の停滞' },
  '皇帝': { upright: '安定・統率力・構造化・責任ある決断', reversed: '支配的・頑固・柔軟性の欠如' },
  '教皇': { upright: '教え・伝統・信頼できる助言・精神的な導き', reversed: '形式主義・独善・自分の声を聞けない' },
  '恋人たち': { upright: '選択・調和・深い結びつき・価値観の一致', reversed: '不調和・迷い・価値観の衝突' },
  '戦車': { upright: '前進・意志の勝利・困難の突破・行動力', reversed: '暴走・方向性の喪失・制御不能' },
  '力': { upright: '内なる強さ・忍耐・優しさで導く力・自制心', reversed: '自信喪失・感情に飲まれる・弱気' },
  '隠者': { upright: '内省・真理の探求・孤独の中の気づき・賢者の時間', reversed: '孤立・引きこもり・答えを見つけられない' },
  '運命の輪': { upright: '転機・流れの変化・チャンスの到来・運命の動き', reversed: '停滞・悪循環・変化への抵抗' },
  '正義': { upright: '公正・バランス・因果応報・正しい判断', reversed: '不公正・偏り・責任逃れ' },
  '吊るされた男': { upright: '視点の転換・手放し・忍耐の先の悟り・犠牲', reversed: '無意味な犠牲・頑固・変化の拒否' },
  '死神': { upright: '終わりと始まり・変容・古いものの手放し・再生', reversed: '変化への恐怖・執着・停滞' },
  '節制': { upright: '調和・バランス・忍耐・中庸の知恵', reversed: '不均衡・極端・焦り' },
  '悪魔': { upright: '執着・誘惑・束縛・欲望との向き合い', reversed: '解放・束縛からの脱出・気づき' },
  '塔': { upright: '突然の変化・崩壊と再構築・真実の露呈', reversed: '変化の回避・小さな警告・衝撃の軽減' },
  '星': { upright: '希望・癒し・インスピレーション・未来への信頼', reversed: '希望の喪失・失望・自信の欠如' },
  '月': { upright: '不安・幻想・潜在意識・直感を頼りに進む', reversed: '混乱の解消・真実が見える・恐怖の克服' },
  '太陽': { upright: '成功・喜び・達成・エネルギーの充実', reversed: '自信過剰・成功の遅れ・楽観しすぎ' },
  '審判': { upright: '覚醒・再生・使命への目覚め・過去の清算', reversed: '自己批判・後悔・決断の先延ばし' },
  '世界': { upright: '完成・達成・統合・新たなステージへ', reversed: '未完了・あと一歩・視野の狭さ' },
};

function getAstronomicalData(startDate, months) {
  const moonPhases = JSON.parse(fs.readFileSync(MOON_PHASES_PATH, 'utf8'));
  const ephemeris = JSON.parse(fs.readFileSync(EPHEMERIS_PATH, 'utf8'));

  const start = new Date(startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  const endStr = end.toISOString().slice(0, 10);

  const relevantMoons = moonPhases.filter(m =>
    m.date_jst >= startDate && m.date_jst <= endStr
  );

  const relevantIngresses = ephemeris.ingresses.filter(ig =>
    ig.date >= startDate && ig.date <= endStr
  );

  const startEntry = ephemeris.data.find(e => e.date === startDate);
  const planets = startEntry ? startEntry.planets : {};

  const retrograde = ephemeris.mercuryRetrograde.filter(mr =>
    mr.end >= startDate && mr.start <= endStr
  );

  return { moonPhases: relevantMoons, ingresses: relevantIngresses, planets, mercuryRetrograde: retrograde };
}

function buildAstroDataForPrompt(data) {
  let text = '【天文データ（この期間のみ使用。創作禁止）】\n';

  text += '\n月相:\n';
  for (const m of data.moonPhases) {
    const phase = m.phase === 'new_moon' ? '新月' : '満月';
    text += `${m.date_jst} ${m.time_jst} JST  ${phase}  ${m.sign_jp}\n`;
  }

  text += '\n惑星イングレス:\n';
  for (const ig of data.ingresses) {
    text += `${ig.date} ${ig.planetJp} ${ig.fromSignJp}→${ig.toSignJp}\n`;
  }

  text += '\n現在の惑星位置:\n';
  for (const [name, info] of Object.entries(data.planets)) {
    const jp = { mercury: '水星', venus: '金星', mars: '火星', jupiter: '木星', saturn: '土星' };
    text += `${jp[name] || name}: ${info.signJp}\n`;
  }

  if (data.mercuryRetrograde.length > 0) {
    text += '\n水星逆行:\n';
    for (const mr of data.mercuryRetrograde) {
      text += `${mr.start} 〜 ${mr.end}\n`;
    }
  } else {
    text += '\n水星逆行: この期間なし\n';
  }

  return text;
}

async function generateReadingPdf(request, opts = {}) {
  const testVariant = opts.testVariant || '3';
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const sign = ZODIAC_SIGNS.find(s => s.id === request.sign);
  const signName = sign ? sign.name : request.sign;
  const signSymbol = { aries: '♈', taurus: '♉', gemini: '♊', cancer: '♋', leo: '♌', virgo: '♍', libra: '♎', scorpio: '♏', sagittarius: '♐', capricorn: '♑', aquarius: '♒', pisces: '♓' }[request.sign] || '★';

  const lp = lifePathNumber(request.birthday);
  const now = new Date();
  const year = now.getFullYear();
  const py = personalYear(request.birthday, year);
  const pm = personalMonth(request.birthday, year, now.getMonth() + 1);
  const today = now.toISOString().slice(0, 10);

  // 3年分の個人年数
  const py1 = py;
  const py2 = personalYear(request.birthday, year + 1);
  const py3 = personalYear(request.birthday, year + 2);

  // ライフパスの一行解説
  const LP_LABELS = {
    1: '開拓者 — 自分の道を切り拓く人',
    2: '調和者 — 繋がりの中で力を発揮する人',
    3: '表現者 — 言葉と感性で世界を動かす人',
    4: '建設者 — 確かな土台を積み上げる人',
    5: '冒険者 — 変化を力に変える人',
    6: '奉仕者 — 守ることで輝く人',
    7: '探究者 — 深く知ることで答えを出す人',
    8: '実現者 — 結果を出して道を示す人',
    9: '完成者 — 広い視野で全体を照らす人',
    11: '直感者 — 見えないものを感じ取る人',
    22: '大建設者 — 大きな仕組みを現実にする人',
    33: '大奉仕者 — 無条件の愛で導く人',
  };

  // 個人年数のテーマ（表示用）
  const PY_THEMES = {
    1: '始まりの年 — 新しいことを始める',
    2: '協力の年 — 待つことで実る',
    3: '表現の年 — 発信と交流が広がる',
    4: '基盤の年 — 足元を固める',
    5: '変化の年 — 動くことで道が開く',
    6: '責任の年 — 守るものを選び直す',
    7: '内省の年 — 立ち止まって深く考える',
    8: '収穫の年 — 結果と評価を得る',
    9: '完了の年 — 手放して次に備える',
    11: '覚醒の年 — 直感が冴える',
    22: '大建設の年 — 大きな形を作る',
  };

  // タイムライン用：短いキーワード
  const PY_SHORT = {
    1: '新しい始まり',
    2: '信頼と協力',
    3: '発信と拡大',
    4: '土台づくり',
    5: '変化と挑戦',
    6: '選び直す',
    7: '立ち止まる',
    8: '収穫と勝負',
    9: '手放しと整理',
    11: '直感が冴える',
    22: '大きな形を作る',
  };

  // タイムライン用：一行説明
  const PY_DESC = {
    1: '次の9年サイクルが始まる年',
    2: '焦らず人との繋がりで実る年',
    3: '自分を外に出すほど広がる年',
    4: '地道に積み上げることが力になる年',
    5: '環境を変えることで道が開く年',
    6: '何を守り何を手放すか選ぶ年',
    7: '答えを急がず深く考える年',
    8: '努力が結果と評価に変わる年',
    9: '合わないものを終わらせる年',
    11: '見えないものを感じ取れる年',
    22: '大きな仕組みを現実にする年',
  };

  const cardName = TAROT_NAMES[request.tarot_card?.id || 0];
  const cardPosition = request.tarot_card?.reversed ? '逆位置' : '正位置';
  const cardFilename = TAROT_FILENAMES[request.tarot_card?.id || 0];
  const cardImagePath = path.join(ASSETS_DIR, 'tarot', cardFilename);

  // 天文データ取得
  const astroData = getAstronomicalData(today, 2);
  const astroText = buildAstroDataForPrompt(astroData);

  let prompt;

  if (testVariant === '1' || testVariant === '2') {
    // テスト1・2: プロンプトOS + モジュール方式
    const promptOsPath = path.join(__dirname, '..', '..', 'config', 'reading-prompt-system.md');
    const promptOs = fs.readFileSync(promptOsPath, 'utf8');
    const subModuleMap = { 'work:people': '人間関係モジュール' };
    const moduleMap = { love: '恋愛モジュール', relation: '人間関係モジュール', work: '転職・キャリアモジュール' };
    const moduleName = subModuleMap[`${request.category}:${request.subcategory}`] || moduleMap[request.category] || '転職・キャリアモジュール';

    const sharedData = `
### 今回使用するモジュール: ${moduleName}

### 相談者情報
- 呼び名: ${request.name}
- 生年月日: ${request.birthday}
- 太陽星座: ${signName}（${signSymbol}）
- ライフパスナンバー: ${lp}
- 個人年数: ${py}
- 個人月数: ${pm}

### 相談内容
- カテゴリ: ${request.category_label}
- サブカテゴリ: ${request.subcategory_label}
- Q1（状況）: ${request.q1}
- Q2（気になる点）: ${request.q2}
- Q3（自由記述）: ${request.q3 || '（なし）'}

### タロット
- カード: ${cardName}（${cardPosition}）

${astroText}
`;

    if (testVariant === '1') {
      prompt = `あなたは占い師「カイ」です。西洋占星術・数秘術・タロットの3軸で個別鑑定を行います。
穏やかで寄り添うが、甘いだけではない。受容95%、問いかけ5%。星座や数秘の特性は断言する。
Markdown記法は使わない。太字は <strong>タグ</strong>。呼び名には「さん」を1回だけ。配列の各要素は独立した段落。

${sharedData}

### 出力構成（7ページ・約2500文字）
P1: 表紙と挨拶（100〜200文字）— 相談内容に触れた短い語りかけ
P2: 現状の受容と共感（400〜500文字）— ユーザーの言葉を反復しながら肯定
P3: 本質・占星術と数秘術（500〜600文字）— 性質を具体的に断言。最大ボリューム
P4: 今の時期の意味・タロット（400〜500文字）— カードが示す現状解釈
P5: カイからの問いかけ（200〜300文字）— 2〜3問の問いだけ。余白で立ち止まらせる
P6: 明日への小さな一歩（300〜400文字）— 行動提案1〜2つ。天文日付と紐づけ
P7: 結びの言葉（200〜300文字）— 余韻を残す温かいメッセージ

JSONで返してください:
{"p1_greeting":"導入","p2_empathy":["段落1","段落2","段落3","段落4"],"p3_essence":["段落1","段落2","段落3","段落4","段落5"],"p4_timing":["段落1","段落2","段落3","段落4"],"p5_questions":[{"text":"問い1"},{"text":"問い2"}],"p6_actions":[{"title":"タイトル","body":"行動提案"}],"p7_closing":["行1","行2","行3","行4"]}`;
    } else {
      prompt = `あなたは占い師「カイ」です。西洋占星術・数秘術・タロットの3軸で個別鑑定を行います。
穏やかで寄り添うが、甘いだけではない。受容95%、問いかけ5%。星座や数秘の特性は断言する。
Markdown記法は使わない。太字は <strong>タグ</strong>。呼び名には「さん」を1回だけ。配列の各要素は独立した段落。
このPDFは「占い結果を並べる冊子」ではなく「今回の相談に対する回答書」。各ページの役割を重複させない。

${sharedData}

### 出力構成（6ページ・約3000文字）
P1: 表紙＋今回の結論（250〜400文字）— 最初に答えを出す
P2: 今あなたが苦しい理由（450〜600文字）— 本当の苦しさを言語化
P3: この悩みの本質（450〜600文字）— 本当の問題を提示。占術根拠
P4: これからどう動くといいか（500〜700文字）— やること3つ＋やらないこと＋判断基準
P5: これから1〜2ヶ月の流れ（500〜700文字）— 月別テーマ＋好機日・注意日
P6: 最後のメッセージ（250〜400文字）— 感情を回収して締める

JSONで返してください:
{"p1_conclusion":"結論","p2_pain":["段落1","段落2","段落3","段落4"],"p3_core":["段落1","段落2","段落3","段落4"],"p4_actions":{"do":[{"title":"①","body":"行動"},{"title":"②","body":"行動"},{"title":"③","body":"行動"}],"dont":"やらないこと","criteria":"判断基準"},"p5_forecast":{"months":[{"month":"4月","theme":"テーマ","likely":"起きやすいこと","how":"過ごし方"},{"month":"5月","theme":"テーマ","likely":"起きやすいこと","how":"過ごし方"}],"calendar":[{"date":"4月2日","mark":"△","title":"天秤座満月","body":"説明"}]},"p6_closing":["結論","理由","一押し"]}`;
    }
  } else {
    // テスト3/v3: 独自プロンプト（reading-prompt-v3.md）
    const promptV3Path = path.join(__dirname, '..', '..', 'config', 'reading-prompt-v3.md');
    let promptV3;
    if (fs.existsSync(promptV3Path)) {
      promptV3 = fs.readFileSync(promptV3Path, 'utf8');
    }

    if (promptV3) {
      // v3プロンプトの変数を展開
      prompt = promptV3
        .replace('{date}', today)
        .replace('{name}', request.name)
        .replace('{birthday}', request.birthday)
        .replace('{sun_sign}', `${signName}（${signSymbol}）`)
        .replace('{life_path}', String(lp))
        .replace('{personal_year}', String(py))
        .replace('{personal_month}', String(pm))
        .replace('{tarot_card}', cardName)
        .replace('{tarot_position}', cardPosition)
        .replace('{category}', request.category_label)
        .replace('{subcategory}', request.subcategory_label)
        .replace('{q1_text}', request.q1)
        .replace('{q2_text}', request.q2)
        .replace('{q3_text}', request.q3 || '（なし）')
        .replace('{astronomical_data_json}', astroText);

      // JSON出力指示を追加
      prompt += `

---

## 出力形式

Markdown記法は使わない。太字は <strong>タグ</strong>。呼び名には「さん」を1回だけ。
配列の各要素は独立した段落。\\nは使わない。文末は「。」で統一する。

以下のJSON形式で出力してください。全体で約3000文字。

{
  "s1_quote": "悩みの核心を一文で言い切るフレーズ（20〜40文字）",
  "s1_identity": ["悩みの正体を言語化する段落①", "許可を出す段落②", "（追加段落があれば③④）"],
  "s2_sun_sign": "太陽星座の資質が今の悩みにどう影響しているか（80〜120文字）",
  "s2_life_path": "ライフパスナンバーの強みと今の課題との関係（80〜120文字）",
  "s2_personal_year": "個人年数が今年にどう作用しているか（80〜120文字）",
  "s3_quote": "あなたの強みを一文で言い切るフレーズ（20〜40文字）",
  "s3_pattern": ["強みの指摘①（受容から入る）", "その強みの裏にある癖②", "過去にもこうだったはず③", "今回どう活かすか④"],
  "s4_card": ["タロット読み解き①", "見えていない選択肢②", "具体的な行動③", "やらないこと④"],
  "s5_key_dates": {
    "good": [{"date":"4/17","label":"牡羊座新月","advice":"独立の軸を決める日。最初の一歩を置く。"}],
    "caution": [{"date":"4/2","label":"天秤座満月","advice":"周囲の評価に引っ張られて即断しないこと。"}]
  },
  "s6_closing": ["問いかけ（カテゴリに応じた数）", "時間軸の終点", "最後の一文"]
}

s5_key_datesは天文データから好機日を3個、注意日を2〜3個抽出すること。adviceは相談者への具体的な行動アドバイスを1〜2文で書く。`;
    } else {
      prompt = `
# 鑑定プロンプト

あなたは「Fortune by カイ」の占い師カイです。
西洋占星術・数秘術・タロットの3つを使い、相談者の悩みを読み解く個別鑑定書を書いてください。

---

## あなたが売っているもの

占いに来る人は答えを持っている。ただ、それを選んでいい確信がない。
あなたが提供するのは情報ではなく体験。

1. **言語化**: モヤモヤに名前をつける。「そう、それが言いたかった」
2. **許可**: 「あなたの直感は正しい。星もそう示している」
3. **時間軸**: 「いつまで耐えればいい」が分かる安心

この3つを、この順番で届けること。

---

## 絶対ルール

- 主語は星。「あなたはこうすべき」ではなく「星がこう示している」「カードがこう語っている」
- 最初の3行で悩みの正体を言語化し、「あなたは間違っていない」の許可を出す。ここで掴めなければ終わり
- 性格分析を自己紹介コーナーにしない。悩みの読み解きの根拠としてだけ使う
- 受容95%、指摘5%。指摘は「パターン」で1回だけ。必ず「その裏にはこの強みがある」で返す
- 時期は「そのうち良くなる」ではなく具体日付。天文データから導出する
- 同じ解釈を別の言葉で繰り返さない。読み進めるたびに新しい情報を出す
- 天文データに記載のないイベントを創作しない
- 「かもしれません」を連発しない。占い師として断言する
- 文末を「。」で統一する（ピリオド「.」は使わない）
- Markdown記法（**太字**等）は使わない。太字にしたい場合は <strong>タグ</strong> を使う
- 呼び名には「さん」を1回だけ付ける（例: ハルさん）。「○○さんさん」と重複させない
- 配列の各要素は独立した段落。\\nは使わない

---

## 3つの占術の役割

| 占術 | 役割 | 使う場面 |
|------|------|---------|
| 数秘術 | 「あなたは誰で、今年はどういう年か」。内側のサイクル | 言語化＋許可 |
| 西洋占星術 | 「なぜ今このタイミングで苦しいのか」。外側の力 | 許可＋時間軸 |
| タロット | 「で、どうすべきか」。悩みへの回答 | 決断＋行動 |

この順番で使う。タロットは最後。回答を先に出さず、状況の読み解きを先にする。

---

## 相談者データ

- 鑑定日: ${today}
- 呼び名: ${request.name}
- 生年月日: ${request.birthday}
- 太陽星座: ${signName}（${signSymbol}）
- ライフパスナンバー: ${lp}
- 個人年数: ${py}
- 個人月数: ${pm}
- カテゴリ: ${request.category_label}
- サブカテゴリ: ${request.subcategory_label}
- Q1（状況）: ${request.q1}
- Q2（気になる点）: ${request.q2}
- Q3（自由記述）: ${request.q3 || '（なし）'}
- タロット: ${cardName}（${cardPosition}）

## 天文データ

${astroText}

上記の天文データに記載された日付・星座のみを使用すること。記載のない天文イベントを創作しないこと。

---

## 出力形式

以下のJSON形式で出力してください。全体で約3000文字。

{
  "s1_quote": "悩みの核心を一文で言い切るフレーズ（20〜40文字）",
  "s1_identity": ["悩みの正体を言語化する段落①", "個人年数・個人月数で今の苦しさを説明する段落②", "許可を出す段落③", "（必要なら追加段落④）"],
  "s2_timing": ["惑星の動きで今この時期に表面化した理由を語る段落①", "月相との関連②", "この時期の意味づけ③"],
  "s3_pattern": ["太陽星座×ライフパスのパターン指摘①（受容から入る）", "パターンの裏にある強み②", "過去にもこうだったはず③"],
  "s4_card": ["タロットカードの読み解き①", "相談者が見えていない選択肢②", "具体的な行動を天文日付に紐づけて③", "やらないこと④"],
  "s5_key_dates": {
    "good": [{"date":"4/17","label":"牡羊座新月","advice":"独立の軸を決める日。最初の一歩を置く。"}],
    "caution": [{"date":"4/2","label":"天秤座満月","advice":"周囲の評価に引っ張られて即断しないこと。"}]
  },
  "s6_closing": ["相談キーワードを使ったまとめ①", "時間軸の終点②", "前を向ける最後の一文③"]
}

s5_key_datesは天文データから好機日を3個、注意日を2〜3個抽出すること。adviceは相談者への具体的な行動アドバイスを1〜2文で書く。
`;
    } // end if(promptV3) else
  } // end testVariant switch

  // klaw に投げて鑑定文を生成
  console.log(`[reading] Generating content for ${request.name}...`);

  // spawnSync で node → openclaw.mjs を直接呼び出す（MSYSシェルの引数上限を回避）
  const openclawMjs = path.join(process.env.APPDATA, 'npm', 'node_modules', 'openclaw', 'openclaw.mjs');

  let contentJson;
  try {
    const result = spawnSync(process.execPath, [
      openclawMjs, 'agent',
      '--message', prompt,
      '--session-id', `reading-gen-${Date.now()}`,
      '--json',
    ], { timeout: 180_000, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });

    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(result.stderr || `exit code ${result.status}`);

    const stdout = result.stdout;
    const data = JSON.parse(stdout);
    const text = data.result?.payloads?.[0]?.text || data.payloads?.[0]?.text || stdout.trim();

    // JSON 部分を抽出（ネストされた {} に対応）
    let depth = 0, start = -1, jsonStr = null;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') { if (depth === 0) start = i; depth++; }
      else if (text[i] === '}') { depth--; if (depth === 0 && start >= 0) { jsonStr = text.slice(start, i + 1); break; } }
    }
    if (!jsonStr) throw new Error('No JSON found in response');
    // デバッグ: JSON文字列をファイルに保存
    fs.writeFileSync(path.join(OUTPUT_DIR, `${request.id}_raw.json`), jsonStr, 'utf8');
    contentJson = JSON.parse(jsonStr);
  } catch (err) {
    console.error(`[reading] klaw error: ${err.message}`);
    throw err;
  }

  // HTML テンプレートに変数を挿入
  console.log(`[reading] Building HTML...`);
  const templateFile = testVariant ? `reading-template-test${testVariant}.html` : 'reading-template.html';
  let html = fs.readFileSync(path.join(TEMPLATE_DIR, templateFile), 'utf8');

  const formatDate = (d) => {
    const [y, m, day] = d.split('-');
    return `${y}年${parseInt(m)}月${parseInt(day)}日`;
  };

  const vars = {
    '{{date}}': formatDate(today),
    '{{name}}': request.name,
    '{{sign_symbol}}': signSymbol,
    '{{sign_name}}': signName,
    '{{birthday_formatted}}': formatDate(request.birthday),
    '{{life_path}}': String(lp),
    '{{life_path_label}}': LP_LABELS[lp] || '',
    '{{personal_year}}': String(py),
    '{{personal_year_theme}}': PY_THEMES[py] || '',
    '{{py1}}': String(py1),
    '{{py1_theme}}': PY_THEMES[py1] || '',
    '{{py1_theme_short}}': PY_SHORT[py1] || '',
    '{{py1_theme_desc}}': PY_DESC[py1] || '',
    '{{py1_year}}': String(year),
    '{{py2}}': String(py2),
    '{{py2_theme}}': PY_THEMES[py2] || '',
    '{{py2_theme_short}}': PY_SHORT[py2] || '',
    '{{py2_theme_desc}}': PY_DESC[py2] || '',
    '{{py2_year}}': String(year + 1),
    '{{py3}}': String(py3),
    '{{py3_theme}}': PY_THEMES[py3] || '',
    '{{py3_theme_short}}': PY_SHORT[py3] || '',
    '{{py3_theme_desc}}': PY_DESC[py3] || '',
    '{{py3_year}}': String(year + 2),
    '{{category_label}}': request.category_label,
    '{{subcategory_label}}': request.subcategory_label,
    '{{consultation_text}}': request.q3 || `${request.q1}。気になる点：${request.q2}`,
    '{{tarot_card_name}}': cardName,
    '{{tarot_position}}': cardPosition,
    '{{tarot_image_path}}': cardImagePath.replace(/\\/g, '/'),
    '{{tarot_meaning}}': (TAROT_MEANINGS[cardName] || {})[request.tarot_card?.reversed ? 'reversed' : 'upright'] || '',
    '{{p4_title}}': ({ 'work:career': 'あなたが持っている力', 'work:people': 'あなたが持っている力', 'love:start': 'あなたの愛し方', 'love:partner': 'あなたの愛し方', 'love:reunion': 'あなたの愛し方', 'relation:family': 'あなたと家族の関わり方', 'relation:friend': 'あなたの人との距離感' })[`${request.category}:${request.subcategory}`] || 'あなたが持っている力',
    '{{s1_quote}}': contentJson.s1_quote || '',
    '{{s3_quote}}': contentJson.s3_quote || '',
    '{{identity_image_path}}': path.join(ASSETS_DIR, 'illustrations', 'key-identity.png').replace(/\\/g, '/'),
    '{{stars_image_path}}': path.join(ASSETS_DIR, 'illustrations', 'stars-numerology.png').replace(/\\/g, '/'),
    '{{pattern_image_path}}': path.join(ASSETS_DIR, 'illustrations', 'mirror-pattern.png').replace(/\\/g, '/'),
    '{{closing_image_path}}': path.join(ASSETS_DIR, 'illustrations', 'dawn-closing.png').replace(/\\/g, '/'),
    '{{p1_greeting}}': contentJson.p1_greeting || '',
    '{{p1_conclusion}}': contentJson.p1_conclusion || '',
    '{{p6_closing_html}}': (contentJson.p6_closing || []).map(p => `<p>${p}</p><div class="sp-s"></div>`).join('\n'),
    '{{s6_closing_html}}': (contentJson.s6_closing || []).map(p => `<p>${p}</p><div class="sp-s"></div>`).join('\n'),
  };

  for (const [key, value] of Object.entries(vars)) {
    html = html.replaceAll(key, value);
  }

  // 動的セクション（テスト2: p2_pain等 / テスト3: s1_identity等 を両対応）
  function renderParagraphs(arr) {
    return (arr || []).map(p => `<div class="content-block"><p class="b">${p}</p></div><div class="sp-s"></div>`).join('\n');
  }

  // テスト1形式
  html = html.replace('{{p2_empathy}}', renderParagraphs(contentJson.p2_empathy));
  html = html.replace('{{p3_essence}}', renderParagraphs(contentJson.p3_essence));
  html = html.replace('{{p4_timing}}', renderParagraphs(contentJson.p4_timing));

  let test1ActionsHtml = '';
  for (const action of (contentJson.p6_actions || [])) {
    test1ActionsHtml += `<div class="act"><div class="an">${action.title}</div><p>${action.body}</p></div>\n`;
  }
  html = html.replace('{{p6_actions}}', test1ActionsHtml);

  let questionsHtml = '';
  for (const q of (contentJson.p5_questions || [])) {
    questionsHtml += `<div class="qi"><p><strong>${q.text}</strong></p></div>\n`;
  }
  html = html.replace('{{p5_questions}}', questionsHtml);

  html = html.replace('{{p7_closing_html}}', (contentJson.p7_closing || []).map(p => `<p>${p}</p><div class="sp-s"></div>`).join('\n'));

  // テスト2形式
  html = html.replace('{{p2_pain}}', renderParagraphs(contentJson.p2_pain));
  html = html.replace('{{p3_core}}', renderParagraphs(contentJson.p3_core));

  const actions = contentJson.p4_actions || {};
  let actionsHtml = '';
  for (const action of (actions.do || [])) {
    actionsHtml += `<div class="act"><div class="an">${action.title}</div><p>${action.body}</p></div>\n`;
  }
  if (actions.dont) {
    actionsHtml += `<p style="color:#c27c4c;font-size:13px;line-height:2.0;margin-top:10px;">やらない方がいいこと: ${actions.dont}</p>\n`;
  }
  if (actions.criteria) {
    actionsHtml += `<p style="color:#aaa;font-size:13px;line-height:2.0;margin-top:4px;">判断基準: ${actions.criteria}</p>\n`;
  }
  html = html.replace('{{p4_actions}}', actionsHtml);

  const forecast = contentJson.p5_forecast || {};
  let forecastHtml = '';
  for (const m of (forecast.months || [])) {
    forecastHtml += `<div class="mg z"><div class="mg-h"><div class="mg-num">${m.month}</div><div class="mg-title">${m.theme}</div></div><p style="color:#aaa;font-size:13px;margin-bottom:6px;">起きやすいこと: ${m.likely}</p><p>${m.how}</p></div>\n`;
  }
  if (forecast.calendar && forecast.calendar.length > 0) {
    forecastHtml += `<div class="divider-f"></div><div class="st" style="font-size:14px;">好機日・注意日</div>\n`;
    for (const cal of forecast.calendar) {
      const cls = cal.mark === '△' ? 'cw' : 'cg';
      forecastHtml += `<div class="ci"><div class="cd ${cls}">${cal.date} ${cal.mark}</div><div class="cx"><strong>${cal.title}</strong> — ${cal.body}</div></div>\n`;
    }
  }
  html = html.replace('{{p5_forecast}}', forecastHtml);

  // テスト3形式
  const s1 = contentJson.s1_identity || [];
  const s1Mid = Math.ceil(s1.length / 2);
  html = html.replace('{{s1_identity_top}}', renderParagraphs(s1.slice(0, s1Mid)));
  html = html.replace('{{s1_identity_bottom}}', renderParagraphs(s1.slice(s1Mid)));
  html = html.replace('{{s2_sun_sign}}', contentJson.s2_sun_sign || '');
  html = html.replace('{{s2_life_path}}', contentJson.s2_life_path || '');
  html = html.replace('{{s2_personal_year}}', contentJson.s2_personal_year || '');
  html = html.replace('{{s3_pattern}}', renderParagraphs(contentJson.s3_pattern));
  html = html.replace('{{s4_card}}', renderParagraphs(contentJson.s4_card));
  // 好機日・注意日
  const keyDates = contentJson.s5_key_dates || { good: [], caution: [] };

  // 上部サマリーカード（日付のみ横並び）
  const summaryDates = (items) => (items || []).map(d => `<span>${d.date}</span>`).join('\n');
  const summaryHtml = `<div class="dates-summary">
    <div class="dates-summary-card"><div class="dates-summary-title">★ 好機日</div><div class="dates-summary-dates">${summaryDates(keyDates.good)}</div></div>
    <div class="dates-summary-card caution"><div class="dates-summary-title">⚠ 注意日</div><div class="dates-summary-dates">${summaryDates(keyDates.caution)}</div></div>
  </div>`;
  html = html.replace('{{s5_summary_html}}', summaryHtml);

  // 下部カレンダー（日付＋ラベル＋アドバイス）
  const calEntries = (items, type) => (items || []).map(d => {
    const markClass = type === 'good' ? 'mark-good' : 'mark-caution';
    const markChar = type === 'good' ? '◎' : '△';
    return `<div class="cal-entry"><div class="cal-head"><span class="cal-date">${d.date}</span><span class="mark ${markClass}">${markChar}</span><span class="cal-label">${d.label}</span></div>${d.advice ? `<div class="cal-advice">${d.advice}</div>` : ''}</div>`;
  }).join('\n');
  const calendarHtml = `<div class="cal-section"><div class="st-sub">好機日</div>\n${calEntries(keyDates.good, 'good')}</div>\n<div class="cal-section caution"><div class="st-sub">注意日</div>\n${calEntries(keyDates.caution, 'caution')}</div>`;
  html = html.replace('{{s5_calendar_html}}', calendarHtml);

  // 後処理: Markdown→HTML変換、空段落削除
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/<p class="b"><\/p>(<div class="sp"><\/div>)?\n?/g, '');

  // HTML を一時ファイルに保存
  const htmlPath = path.join(OUTPUT_DIR, `${request.id}.html`);
  const pdfPath = path.join(OUTPUT_DIR, `${request.id}.pdf`);
  fs.writeFileSync(htmlPath, html, 'utf8');

  // Playwright で PDF 生成
  console.log(`[reading] Generating PDF...`);
  const pyScript = `
from playwright.sync_api import sync_playwright
import pathlib
src = pathlib.Path("${htmlPath.replace(/\\/g, '/')}").resolve().as_uri()
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(src, wait_until='networkidle')
    page.emulate_media(media='print')
    page.pdf(path="${pdfPath.replace(/\\/g, '/')}", width='595px', height='842px', print_background=True, margin={'top':'0','right':'0','bottom':'0','left':'0'})
    browser.close()
`;
  execSync(`python3 -c "${pyScript.replace(/"/g, '\\"')}"`, { timeout: 30_000, shell: 'bash' });

  console.log(`[reading] PDF saved: ${pdfPath}`);
  return pdfPath;
}

// CLI 実行用
if (require.main === module) {
  const args = process.argv.slice(2);
  const testIdx = args.indexOf('--test');
  const testNum = testIdx >= 0 ? args[testIdx + 1] : null;
  const requestFile = args.find(a => a !== '--test' && a !== testNum);
  if (!requestFile) {
    console.error('Usage: node generate-reading-pdf.js <request.json> [--test 1|2|3]');
    process.exit(1);
  }
  const request = JSON.parse(fs.readFileSync(requestFile, 'utf8'));
  generateReadingPdf(request, { testVariant: testNum }).then(pdfPath => {
    console.log(`[reading] Done: ${pdfPath}`);
  }).catch(err => {
    console.error('[reading] Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { generateReadingPdf };
