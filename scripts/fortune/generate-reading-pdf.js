'use strict';

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '..', '.env') });

const fs = require('node:fs');
const path = require('node:path');
const { lifePathNumber, personalYear, personalMonth } = require('../../lib/numerology');
const { ZODIAC_SIGNS } = require('../../lib/zodiac');
const { execSync } = require('node:child_process');
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
  const moduleMap = {
    love: '恋愛・不倫モジュール',
    career: '転職・キャリアモジュール',
    general: '将来不安・方向性モジュール',
    destiny: '将来不安・方向性モジュール',
  };

  const prompt = `
${promptOs}

---

### 今回使用するモジュール: ${moduleMap[request.category] || '将来不安・方向性モジュール'}

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
- 呼び名には必ず「さん」を付ける（例: ハルさん）。呼び捨てにしない
- p5_lucky の action は3〜5文字の短い単語にする（例: 朝の散歩、深呼吸、日記）
- 各フィールドの文字数制限を厳守すること。超過するとPDFのレイアウトが崩れる
- 段落区切りは \\n を使う。空行は入れない

### 各フィールドの文字数目安（超過するとレイアウトが崩れるため厳守）
- p1_star_placement: 200〜250文字（2〜3段落）
- p2_answer_actions の各 body: 120〜150文字
- p2_answer_actions の各 title: 25文字以内
- p2_tarot_interpretation: 150〜180文字
- p3_astrology: 250〜300文字（3段落）
- p3_numerology_lp: 120〜150文字
- p3_numerology_py: 120〜150文字
- p3_connection: 60〜80文字
- p4_timeline の各 body: 40〜50文字
- p4_calendar の各 body: 30〜40文字
- p4_calendar: 7項目
- p4_calendar_note: 80〜100文字
- p5_lucky_text: 50〜70文字
- p5_allies の各 body: 20〜30文字
- p5_allies: 3項目
- p5_questions の各 text: 50〜70文字
- p5_questions: 3項目
- p5_closing: 120〜150文字

各ページの内容を JSON で返してください:

{
  "p1_star_placement": "（2段落以内、150文字以内。段落は\\nで区切る）",
  "p2_answer_actions": [
    { "title": "①のタイトル（25文字以内）", "body": "①の本文（100文字以内）" },
    { "title": "②のタイトル", "body": "②の本文" },
    { "title": "③のタイトル", "body": "③の本文" }
  ],
  "p2_tarot_interpretation": "（120文字以内）",
  "p3_astrology": "（3段落以内、200文字以内。段落は\\nで区切る）",
  "p3_numerology_lp": "（100文字以内）",
  "p3_numerology_py": "（100文字以内）",
  "p3_connection": "（80文字以内）",
  "p4_timeline": [
    { "month": "4月", "theme": "テーマ（5文字）", "body": "本文（40文字以内）" },
    { "month": "5月", "theme": "テーマ", "body": "本文" },
    { "month": "6月", "theme": "テーマ", "body": "本文" }
  ],
  "p4_calendar": [
    { "date": "4月2日", "mark": "◎", "title": "天秤座満月", "body": "説明（30文字以内）" }
  ],
  "p4_calendar_note": "（80文字以内）",
  "p5_lucky": { "color": "色", "number": "数字", "direction": "方角", "action": "アクション" },
  "p5_lucky_text": "（50文字以内）",
  "p5_allies": [
    { "sign": "♐ 射手座", "reason": "根拠（10文字）", "body": "説明（20文字以内）" }
  ],
  "p5_questions": [
    { "text": "問い1の全文" },
    { "text": "問い2の全文" },
    { "text": "問い3の全文" }
  ],
  "p5_closing": "最後のメッセージ"
}
`;

  // klaw に投げて鑑定文を生成
  console.log(`[reading] Generating content for ${request.name}...`);
  const tmpFile = path.join(os.tmpdir(), `reading-prompt-${request.id}.txt`);
  fs.writeFileSync(tmpFile, prompt, 'utf8');

  let contentJson;
  try {
    const stdout = execSync(
      `openclaw agent --message "$(cat '${tmpFile.replace(/\\/g, '/')}')" --session-id reading-gen --json`,
      { timeout: 180_000, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, shell: 'bash' },
    );

    const data = JSON.parse(stdout);
    const text = data.result?.payloads?.[0]?.text || stdout.trim();

    // JSON 部分を抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    contentJson = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error(`[reading] klaw error: ${err.message}`);
    throw err;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
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
    '{{life_path}}': String(lp),
    '{{personal_year}}': String(py),
    '{{personal_month}}': String(pm),
    '{{month_label}}': `${now.getMonth() + 1}月の個人月`,
    '{{category_label}}': request.category_label,
    '{{subcategory_label}}': request.subcategory_label,
    '{{consultation_text}}': request.q3 || `${request.q1}。${Array.isArray(request.q2) ? request.q2.join('、') : request.q2}について知りたい。`,
    '{{tarot_card_name}}': cardName,
    '{{tarot_position}}': cardPosition,
    '{{tarot_image_path}}': cardImagePath.replace(/\\/g, '/'),
    '{{p1_star_placement}}': (contentJson.p1_star_placement || '').split('\n').map(p => `<p class="b">${p}</p><div class="sp"></div>`).join('\n'),
    '{{p2_tarot_interpretation}}': contentJson.p2_tarot_interpretation || '',
    '{{p3_astrology}}': (contentJson.p3_astrology || '').split('\n').map(p => `<p class="b">${p}</p><div class="sp"></div>`).join('\n'),
    '{{p3_connection}}': contentJson.p3_connection || '',
    '{{p3_numerology_lp}}': contentJson.p3_numerology_lp || '',
    '{{p3_numerology_py}}': contentJson.p3_numerology_py || '',
    '{{p4_calendar_note}}': contentJson.p4_calendar_note || '',
    '{{p5_lucky_color}}': contentJson.p5_lucky?.color || '',
    '{{p5_lucky_number}}': contentJson.p5_lucky?.number || '',
    '{{p5_lucky_direction}}': contentJson.p5_lucky?.direction || '',
    '{{p5_lucky_action}}': contentJson.p5_lucky?.action || '',
    '{{p5_lucky_text}}': contentJson.p5_lucky_text || '',
    '{{p5_closing}}': contentJson.p5_closing || '',
  };

  for (const [key, value] of Object.entries(vars)) {
    html = html.replaceAll(key, value);
  }

  // 動的セクション: アクション、タイムライン、カレンダー、味方星座、問い
  let actionsHtml = '';
  for (const action of (contentJson.p2_answer_actions || [])) {
    actionsHtml += `<div class="act"><div class="an">${action.title}</div><p>${action.body}</p></div>\n`;
  }
  html = html.replace('{{p2_actions}}', actionsHtml);

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

  let alliesHtml = '';
  for (const ally of (contentJson.p5_allies || [])) {
    alliesHtml += `<div class="ci2"><div class="cs">${ally.sign}</div><div class="cw2">${ally.reason}</div><p>${ally.body}</p></div>\n`;
  }
  html = html.replace('{{p5_allies}}', alliesHtml);

  let questionsHtml = '';
  for (let i = 0; i < (contentJson.p5_questions || []).length; i++) {
    const q = contentJson.p5_questions[i];
    questionsHtml += `<div class="ci"><div class="cd" style="width:20px; color:#c9a84c;">${i + 1}</div><div class="cx">${q.text}</div></div>\n`;
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
  execSync(`python3 -c "${pyScript.replace(/"/g, '\\"')}"`, { timeout: 30_000 });

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
