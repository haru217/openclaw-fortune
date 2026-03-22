'use strict';

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '..', '.env') });

const fs = require('node:fs');
const path = require('node:path');
const { lifePathNumber, personalYear, personalMonth } = require('../../lib/numerology');
const { ZODIAC_SIGNS } = require('../../lib/zodiac');
const { execSync, spawnSync } = require('node:child_process');
const os = require('node:os');

const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'data', 'templates', 'reading-template.html');
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

async function generateReadingPdf(request) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const sign = ZODIAC_SIGNS.find(s => s.id === request.sign);
  const signName = sign ? sign.name : request.sign;
  const signSymbol = { aries: '♈', taurus: '♉', gemini: '♊', cancer: '♋', leo: '♌', virgo: '♍', libra: '♎', scorpio: '♏', sagittarius: '♐', capricorn: '♑', aquarius: '♒', pisces: '♓' }[request.sign] || '★';

  const lp = lifePathNumber(request.birthday);
  const now = new Date();
  const py = personalYear(request.birthday, now.getFullYear());
  const pm = personalMonth(request.birthday, now.getFullYear(), now.getMonth() + 1);
  const today = now.toISOString().slice(0, 10);

  const cardName = TAROT_NAMES[request.tarot_card?.id || 0];
  const cardPosition = request.tarot_card?.reversed ? '逆位置' : '正位置';
  const cardFilename = TAROT_FILENAMES[request.tarot_card?.id || 0];
  const cardImagePath = path.join(ASSETS_DIR, 'tarot', cardFilename);

  // 天文データ取得
  const astroData = getAstronomicalData(today, 3);
  const astroText = buildAstroDataForPrompt(astroData);

  // プロンプトOS の共通骨格 + 悩み別モジュール + 変数を結合
  const promptOsPath = path.join(__dirname, '..', '..', 'config', 'reading-prompt-system.md');
  const promptOs = fs.readFileSync(promptOsPath, 'utf8');

  // カテゴリからモジュールを決定
  // サブカテゴリ固有のモジュールがあればそちらを優先
  const subModuleMap = {
    'career:restart': '復職・新しい働き方モジュール',
  };
  const moduleMap = {
    love: '恋愛・不倫モジュール',
    relationship: '人間関係モジュール',
    career: '転職・キャリアモジュール',
    general: '将来不安・方向性モジュール',
    destiny: '将来不安・方向性モジュール',
  };

  const prompt = `
${promptOs}

---

### 今回使用するモジュール: ${subModuleMap[`${request.category}:${request.subcategory}`] || moduleMap[request.category] || '将来不安・方向性モジュール'}

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
- Q2（知りたいこと）: ${Array.isArray(request.q2) ? request.q2.join(', ') : request.q2}
- Q3（自由記述）: ${request.q3 || '（なし）'}

### タロット
- カード: ${cardName}（${cardPosition}）

${astroText}

---

上記の情報に基づいて、5ページ分の鑑定文を生成してください。

### 重要なフォーマットルール（厳守）
- Markdown記法（**太字**等）は使わない。太字にしたい場合は <strong>タグ</strong> を使う
- 呼び名には「さん」を1回だけ付ける（例: ハルさん）。「○○さんさん」と重複させない。呼び捨てにしない
- 配列の各要素は独立した段落。\\nは使わない

### 文体ルール（必須）
- 比喩は1ページ1つまで。使ったら残りは平易な言葉で書く
- 抽象語の直後に平易な言い換えを添える
- 星の説明は1ページ3行まで。星は根拠であって主役ではない
- 中学生が初見で意味が通じる文章を書く
- 「かもしれません」は1ページ1回まで
- 「最強」「絶対」「必ず」等の煽り表現は使わない
- 一人称でカイを名乗らない（「カイが思うに」等は禁止）

### 痛点ルール（必須）
P2で、相談者の星座×数秘の「無意識に繰り返すパターン」を断定的に提示する。
「〜ではなかったでしょうか」のような弱い問いかけではなく、「これが○○さんのパターンです」と言い切る。

### カレンダーのルール
- 5〜7日を選ぶ。◎（好機）と△（注意）を混ぜる。全部◎にしない
- 満月系は△にしやすい（「感情が強く出やすい」「即断を避ける」）
- 注意日には回避アクションを必ず書く

### アクションのトーンルール
- 「宿題」ではなく「体験」として提案する
- ビジネス用語は使わない（棚卸し、数値付きで整理 → NG）
- タイトルは3種類のアンカーを混ぜる（日付・行動・人物）。3つとも日付始まりにしない

### 各フィールドの文字数目安（超過するとページからはみ出す）
- p1_portrait: 各段落60〜80文字、2段落
- p1_preview: 30〜50文字
- p2_pattern: 各段落50〜80文字、3段落
- p2_actions の各 body: 80〜100文字
- p3_guide の各 body: 80〜100文字
- p3_guide の各 avoid: 30〜50文字
- p4_timeline の各 body: 30〜40文字
- p4_calendar の各 body: 20〜30文字
- p4_calendar_note: 50〜70文字
- p4_daily_action: 50〜80文字
- p5_questions の各 text: 20〜30文字（短いほど刺さる。補足説明は不要）
- p5_closing: 各行30〜50文字、2〜3行

各ページの内容を JSON で返してください:

{
  "p1_portrait": ["1段落目（性格描写）", "2段落目（今年の運勢）"],
  "p1_preview": "核心の予告（1文）",
  "p2_pattern": ["1段落目（パターンの指摘）", "2段落目（具体的な描写）", "3段落目（今年のチャンス）"],
  "p2_actions": [
    { "title": "①のタイトル", "body": "①の本文（80〜100文字）" },
    { "title": "②のタイトル", "body": "②の本文" },
    { "title": "③のタイトル", "body": "③の本文" }
  ],
  "p3_guide": [
    { "num": 1, "title": "ヶ月目のタイトル", "month_label": "4月", "body": "やること", "avoid": "避けること" },
    { "num": 2, "title": "ヶ月目のタイトル", "month_label": "5月", "body": "やること", "avoid": "避けること" },
    { "num": 3, "title": "ヶ月目のタイトル", "month_label": "6月", "body": "やること", "avoid": "避けること" }
  ],
  "p4_timeline": [
    { "month": "4月", "theme": "テーマ（5文字）", "body": "本文（40文字以内）" },
    { "month": "5月", "theme": "テーマ", "body": "本文" },
    { "month": "6月", "theme": "テーマ", "body": "本文" }
  ],
  "p4_calendar": [
    { "date": "4月2日", "mark": "△", "title": "天秤座満月", "body": "説明（30文字以内）" }
  ],
  "p4_calendar_note": "使い方の一言（70文字以内）",
  "p4_daily_action": "毎日続けること（80文字以内）",
  "p5_questions": [
    { "text": "問い1" },
    { "text": "問い2" },
    { "text": "問い3" }
  ],
  "p5_closing": ["1行目（受け止め）", "2行目（未来を示す）"]
}
`;

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

    // JSON 部分を抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    contentJson = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error(`[reading] klaw error: ${err.message}`);
    throw err;
  }

  // HTML テンプレートに変数を挿入
  console.log(`[reading] Building HTML...`);
  let html = fs.readFileSync(TEMPLATE_PATH, 'utf8');

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
    '{{category_label}}': request.category_label,
    '{{subcategory_label}}': request.subcategory_label,
    '{{consultation_text}}': request.q3 || `${request.q1}。${Array.isArray(request.q2) ? request.q2.join('、') : request.q2}について知りたい。`,
    '{{tarot_card_name}}': cardName,
    '{{tarot_position}}': cardPosition,
    '{{tarot_image_path}}': cardImagePath.replace(/\\/g, '/'),
    '{{p1_portrait}}': (contentJson.p1_portrait || []).map(p => `<p class="b">${p}</p><div class="sp-s"></div>`).join('\n'),
    '{{p1_preview}}': contentJson.p1_preview || '',
    '{{p4_calendar_note}}': contentJson.p4_calendar_note || '',
    '{{p4_daily_action}}': contentJson.p4_daily_action || '',
    '{{p5_closing_html}}': (contentJson.p5_closing || []).map(p => `<p>${p}</p><div class="sp-s"></div>`).join('\n'),
  };

  for (const [key, value] of Object.entries(vars)) {
    html = html.replaceAll(key, value);
  }

  // 動的セクション: パターン、アクション、月別ガイド、タイムライン、カレンダー、問い
  let patternHtml = '';
  for (const p of (contentJson.p2_pattern || [])) {
    patternHtml += `<p>${p}</p><div class="sp"></div>\n`;
  }
  html = html.replace('{{p2_pattern}}', patternHtml);

  let actionsHtml = '';
  for (const action of (contentJson.p2_actions || [])) {
    actionsHtml += `<div class="act"><div class="an">${action.title}</div><p>${action.body}</p></div>\n`;
  }
  html = html.replace('{{p2_actions}}', actionsHtml);

  let guideHtml = '';
  for (const g of (contentJson.p3_guide || [])) {
    guideHtml += `<div class="mg z"><div class="mg-h"><div class="mg-num">${g.num}</div><div class="mg-title">${g.title}</div><div class="mg-sub">${g.month_label}</div></div><p>${g.body}</p><p class="mg-warn">避けること: ${g.avoid}</p></div>\n`;
  }
  html = html.replace('{{p3_monthly_guide}}', guideHtml);

  let timelineHtml = '';
  for (const tl of (contentJson.p4_timeline || [])) {
    timelineHtml += `<div class="tl-m"><div class="ml">${tl.month}</div><div class="ms">${tl.theme}</div><p>${tl.body}</p></div>\n`;
  }
  html = html.replace('{{p4_timeline}}', timelineHtml);

  let calendarHtml = '';
  for (const cal of (contentJson.p4_calendar || [])) {
    const cls = cal.mark === '△' ? 'cw' : 'cg';
    calendarHtml += `<div class="ci"><div class="cd ${cls}">${cal.date} ${cal.mark}</div><div class="cx"><strong>${cal.title}</strong> — ${cal.body}</div></div>\n`;
  }
  html = html.replace('{{p4_calendar}}', calendarHtml);

  let questionsHtml = '';
  for (const q of (contentJson.p5_questions || [])) {
    questionsHtml += `<div class="qi"><p><strong>${q.text}</strong></p></div>\n`;
  }
  html = html.replace('{{p5_questions}}', questionsHtml);

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
  const requestFile = process.argv[2];
  if (!requestFile) {
    console.error('Usage: node generate-reading-pdf.js <request.json>');
    process.exit(1);
  }
  const request = JSON.parse(fs.readFileSync(requestFile, 'utf8'));
  generateReadingPdf(request).then(pdfPath => {
    console.log(`[reading] Done: ${pdfPath}`);
  }).catch(err => {
    console.error('[reading] Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { generateReadingPdf };
