'use strict';

// R2 への画像アップロードは wrangler r2 object put で行う。
// このスクリプトは assets/ 内の全画像を R2 バケットにアップロードする。

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets');
const BUCKET_NAME = 'openclaw-fortune-assets';

function uploadFile(localPath, remotePath) {
  console.log(`[upload] ${remotePath}`);
  execSync(
    `wrangler r2 object put "${BUCKET_NAME}/${remotePath}" --file="${localPath}"`,
    { stdio: 'inherit' }
  );
}

function main() {
  const tarotDir = path.join(ASSETS_DIR, 'tarot');
  if (fs.existsSync(tarotDir)) {
    const files = fs.readdirSync(tarotDir).filter(file => file.endsWith('.jpg'));
    for (const file of files) {
      uploadFile(path.join(tarotDir, file), `tarot/${file}`);
    }
  }

  for (const file of ['profile-icon.jpg', 'welcome-hero.jpg']) {
    const filePath = path.join(ASSETS_DIR, file);
    if (fs.existsSync(filePath)) {
      uploadFile(filePath, file);
    }
  }

  console.log('[upload] Done.');
}

main();
