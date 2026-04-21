#!/usr/bin/env node
/**
 * Genera los íconos PNG para el PWA a partir del SVG.
 * Requiere: npm install -g sharp-cli  o  npx @squoosh/cli
 *
 * Uso:  node generate-icons.js
 * Requiere: sharp  (npm install sharp)
 */

const fs   = require('fs');
const path = require('path');

async function generateIcons() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('❌  Instala sharp primero:  npm install sharp');
    process.exit(1);
  }

  const svgPath = path.join(__dirname, 'public', 'icon.svg');
  const svgBuf  = fs.readFileSync(svgPath);

  const sizes = [192, 512];
  for (const size of sizes) {
    const outPath = path.join(__dirname, 'public', `icon-${size}.png`);
    await sharp(svgBuf)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`✅  Generado: icon-${size}.png`);
  }

  // Apple touch icon (180×180)
  const applePath = path.join(__dirname, 'public', 'apple-touch-icon.png');
  await sharp(svgBuf).resize(180, 180).png().toFile(applePath);
  console.log('✅  Generado: apple-touch-icon.png');

  console.log('\n🎉  Íconos listos.');
}

generateIcons();
