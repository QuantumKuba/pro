/**
 * Ghost Feed Icon - Semi-transparent candlestick
 */
export default (className?: string) => (
  <svg class={`icon-overlay ${className ?? ''}`} viewBox="0 0 22 22">
    {/* Ghost candlestick body */}
    <rect x="8" y="6" width="6" height="10"
      fill="#673ab7" fill-opacity="0.25"
      stroke="#673ab7" stroke-width="1.5"
      stroke-dasharray="2,1" />
    {/* Upper wick */}
    <line x1="11" y1="3" x2="11" y2="6"
      stroke="#673ab7" stroke-width="1"
      stroke-dasharray="1,1" stroke-opacity="0.6" />
    {/* Lower wick */}
    <line x1="11" y1="16" x2="11" y2="19"
      stroke="#673ab7" stroke-width="1"
      stroke-dasharray="1,1" stroke-opacity="0.6" />
    {/* Ghost effect - glow circles */}
    <circle cx="11" cy="11" r="8" fill="#673ab7" fill-opacity="0.08" />
    <circle cx="11" cy="11" r="5" fill="#673ab7" fill-opacity="0.12" />
  </svg>
)
