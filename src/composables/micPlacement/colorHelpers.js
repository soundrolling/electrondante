// Pure color helpers extracted from MicPlacement.vue
// No reactive state; no side effects.

export function getContrastColor(hexColor) {
  if (!hexColor) return '#000'
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness < 128 ? '#fff' : '#000'
}

// Convert rgba/rgb/hex to hex for color input
export function colorToHex(color) {
  if (!color) return '#ffffff'
  if (color.startsWith('#')) return color
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, '0')
    const g = parseInt(match[2]).toString(16).padStart(2, '0')
    const b = parseInt(match[3]).toString(16).padStart(2, '0')
    return `#${r}${g}${b}`
  }
  return '#ffffff'
}

// Generate a readable color name from a color value
export function getColorName(color) {
  if (!color) return 'Unknown'

  const normalized = color.toLowerCase().trim()

  const colorMap = {
    'rgba(255,255,255,0.92)': 'White',
    'rgba(0,0,0,0.8)': 'Black',
    'rgba(255,0,0,0.9)': 'Red',
    'rgba(0,255,0,0.9)': 'Green',
    'rgba(0,0,255,0.9)': 'Blue',
    'rgba(255,255,0,0.9)': 'Yellow',
    'rgba(255,0,255,0.9)': 'Magenta',
    'rgba(0,255,255,0.9)': 'Cyan'
  }

  if (colorMap[normalized]) return colorMap[normalized]

  const rgbaMatch = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1])
    const g = parseInt(rgbaMatch[2])
    const b = parseInt(rgbaMatch[3])
    return colorNameFromRgb(r, g, b)
  }

  if (normalized.startsWith('#')) {
    let hex = normalized.slice(1)
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('')
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      return colorNameFromRgb(r, g, b)
    }
  }

  return 'Custom'
}

function colorNameFromRgb(r, g, b) {
  if (r > 200 && g > 200 && b > 200) return 'Light'
  if (r < 50 && g < 50 && b < 50) return 'Dark'
  if (r > g && r > b) {
    if (g > 150) return 'Orange'
    if (b > 150) return 'Pink'
    return 'Red'
  }
  if (g > r && g > b) {
    if (r > 150) return 'Yellow-Green'
    if (b > 150) return 'Cyan'
    return 'Green'
  }
  if (b > r && b > g) {
    if (r > 150) return 'Purple'
    if (g > 150) return 'Teal'
    return 'Blue'
  }
  return 'Custom'
}

// Color options used in the colour-button modal
export const COLOR_OPTIONS = [
  { name: 'Red', value: '#ff4d4f' },
  { name: 'Orange', value: '#fa8c16' },
  { name: 'Yellow', value: '#fadb14' },
  { name: 'Green', value: '#52c41a' },
  { name: 'Blue', value: '#1890ff' },
  { name: 'Purple', value: '#722ed1' },
  { name: 'Pink', value: '#eb2f96' },
  { name: 'Cyan', value: '#13c2c2' },
  { name: 'Magenta', value: '#f759ab' },
  { name: 'Lime', value: '#a0d911' }
]

// Color presets used for label backgrounds
export const COLOR_PRESETS = [
  'rgba(255,255,255,0.92)',
  'rgba(0,0,0,0.8)',
  'rgba(255,0,0,0.9)',
  'rgba(0,255,0,0.9)',
  'rgba(0,0,255,0.9)',
  'rgba(255,255,0,0.9)',
  'rgba(255,0,255,0.9)',
  'rgba(0,255,255,0.9)'
]
