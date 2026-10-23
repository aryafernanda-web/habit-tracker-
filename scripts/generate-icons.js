// This script generates PNG icons from the SVG icon for all PWA sizes.
// Run this AFTER npm install with: node scripts/generate-icons.js
// Requires: npm install sharp (add as devDependency if needed)

const fs   = require('fs')
const path = require('path')

async function main() {
  let sharp
  try {
    sharp = require('sharp')
  } catch {
    console.log('Sharp not installed. Using placeholder approach.')
    console.log('To generate icons: npm install sharp && node scripts/generate-icons.js')
    return
  }

  const sizes  = [72, 96, 128, 144, 152, 192, 384, 512]
  const svgSrc = path.join(__dirname, '../public/icons/icon.svg')
  const outDir = path.join(__dirname, '../public/icons')

  for (const size of sizes) {
    await sharp(svgSrc)
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, `icon-${size}x${size}.png`))
    console.log(`Generated icon-${size}x${size}.png`)
  }
  console.log('All icons generated!')
}

main().catch(console.error)
