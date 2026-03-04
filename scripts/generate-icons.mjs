import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = resolve(__dirname, '../public/travela-icon.svg')
const svg = readFileSync(svgPath)

const icons = [
  { size: 192, output: '../public/pwa-192x192.png' },
  { size: 512, output: '../public/pwa-512x512.png' },
  { size: 180, output: '../public/apple-touch-icon.png' },
]

for (const { size, output } of icons) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(resolve(__dirname, output))
  console.log(`Generated ${size}x${size} icon`)
}

console.log('All icons generated successfully')
