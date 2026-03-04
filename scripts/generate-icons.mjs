import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sourcePath = resolve(__dirname, '../public/travela-icon.png')

const icons = [
  { size: 192, output: '../public/pwa-192x192.png' },
  { size: 512, output: '../public/pwa-512x512.png' },
  { size: 180, output: '../public/apple-touch-icon.png' },
]

for (const { size, output } of icons) {
  await sharp(sourcePath)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(resolve(__dirname, output))
  console.log(`Generated ${size}x${size} icon`)
}

console.log('All icons generated successfully')
