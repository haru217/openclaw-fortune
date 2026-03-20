'use strict';

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '..', '.env') });

const { messagingApi } = require('@line/bot-sdk');
const fs = require('node:fs');
const path = require('node:path');

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
});

const blobClient = new messagingApi.MessagingApiBlobClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
});

const RICH_MENU_IMAGE = path.join(__dirname, '..', '..', 'assets', 'rich-menu.png');

async function main() {
  console.log('[rich-menu] Creating rich menu...');

  // Rich menu definition (2 buttons, 2500x843px)
  const richMenu = await client.createRichMenu({
    size: { width: 2500, height: 843 },
    selected: true,
    name: 'fortune-main-menu',
    chatBarText: 'メニュー',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 1250, height: 843 },
        action: { type: 'message', label: '今日の占い', text: '今日の占い' },
      },
      {
        bounds: { x: 1250, y: 0, width: 1250, height: 843 },
        action: { type: 'message', label: '個別鑑定', text: '個別鑑定' },
      },
    ],
  });

  const richMenuId = richMenu.richMenuId;
  console.log(`[rich-menu] Created: ${richMenuId}`);

  // Upload rich menu image if available
  if (!fs.existsSync(RICH_MENU_IMAGE)) {
    console.warn(`[rich-menu] WARNING: ${RICH_MENU_IMAGE} not found.`);
    console.warn('[rich-menu] Create a 2500x843px PNG image and re-run, or upload manually.');
    console.warn(`[rich-menu] Rich menu ID: ${richMenuId} (image not set)`);
  } else {
    const imageBuffer = fs.readFileSync(RICH_MENU_IMAGE);
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    await blobClient.setRichMenuImage(richMenuId, blob);
    console.log('[rich-menu] Image uploaded.');
  }

  // Set as default rich menu
  await client.setDefaultRichMenu(richMenuId);
  console.log('[rich-menu] Set as default rich menu.');
  console.log('[rich-menu] Done.');
}

main().catch((err) => {
  console.error('[rich-menu] Error:', err.message);
  process.exit(1);
});
