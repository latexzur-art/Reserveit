// Placeholder SVG data-URIs for facility cards when cover photos are not yet uploaded.
// Uses muted, desaturated tones with a subtle icon silhouette instead of harsh solid brand colors.
function svgPlaceholder(label: string, bg: string, iconPath: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'>
    <defs>
      <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='${bg}'/>
        <stop offset='100%' stop-color='${bg}' stop-opacity='0.7'/>
      </linearGradient>
    </defs>
    <rect width='100%' height='100%' fill='url(#bg)'/>
    <g transform='translate(200,130)' opacity='0.2'>
      <path d='${iconPath}' fill='white' transform='scale(2.5) translate(-12,-12)'/>
    </g>
    <text x='50%' y='78%' font-family='system-ui,sans-serif' font-size='14' font-weight='600' fill='rgba(255,255,255,0.7)' text-anchor='middle' dominant-baseline='middle' letter-spacing='0.05em'>${label}</text>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// Lucide-compatible 24x24 icon paths (simplified)
const ICON_PATHS = {
  // BookOpen silhouette
  classroom: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  // Monitor silhouette
  computer_lab: 'M2 3h20v14H2zM8 21h8M12 17v4',
  // Home silhouette (multi-purpose)
  mph: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  // Dumbbell / activity
  gym: 'M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3M6 3a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3M2 12h20',
}

export const PLACEHOLDER_BY_TYPE: Record<string, string> = {
  classroom: svgPlaceholder('Classroom', '#334155', ICON_PATHS.classroom),
  computer_lab: svgPlaceholder('Computer Lab', '#1e293b', ICON_PATHS.computer_lab),
  mph: svgPlaceholder('Multi-Purpose Hall', '#44403c', ICON_PATHS.mph),
  gym: svgPlaceholder('Gymnasium', '#1c3829', ICON_PATHS.gym),
}
