export function BatteryGauge({
  value,
  height = 56,
  scale = 1,
}: {
  value: number
  height?: number
  scale?: number
}) {
  const pct = Math.max(0, Math.min(100, value))
  const W = 100
  
  // Apple/Android status bar style proportions
  const bHeight = 34 * scale
  const bWidth = 70 * scale
  const nubWidth = 6 * scale
  const nubHeight = 12 * scale
  
  const startX = (W - (bWidth + nubWidth)) / 2
  const startY = (height - bHeight) / 2
  
  const innerPad = 3 * scale
  const innerMaxW = bWidth - innerPad * 2
  const innerW = Math.max(0, innerMaxW * (pct / 100))
  
  // Colors based on level
  const isCritical = pct <= 20
  const isWarning = pct <= 50 && pct > 20
  const fillColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : 'var(--color-tx)'
  const outlineColor = 'var(--color-tx3)'

  return (
    <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} className="shrink-0">
      {/* Battery outline (shell) */}
      <rect 
        x={startX} 
        y={startY} 
        width={bWidth} 
        height={bHeight} 
        rx={7 * scale} 
        fill="none" 
        stroke={outlineColor} 
        strokeWidth={2.5 * scale} 
        opacity={0.5} 
      />
      
      {/* Terminal nub (right side) */}
      <path 
        d={`M ${startX + bWidth} ${startY + (bHeight - nubHeight)/2} h ${nubWidth - 2} a 2 2 0 0 1 2 2 v ${nubHeight - 4} a 2 2 0 0 1 -2 2 h -${nubWidth - 2} z`}
        fill={outlineColor} 
        opacity={0.5} 
      />
      
      {/* Charge level fill */}
      {innerW > 0 && (
        <rect 
          x={startX + innerPad} 
          y={startY + innerPad} 
          width={innerW} 
          height={bHeight - innerPad * 2} 
          rx={4 * scale} 
          fill={fillColor} 
          opacity={0.9}
        />
      )}
      
      {/* Optional: tiny lightning bolt icon inside if charging, or percentage if user wants it. 
          Leaving it ultra-clean to match the status bar look. */}
    </svg>
  )
}

