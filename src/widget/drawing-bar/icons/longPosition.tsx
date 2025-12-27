/**
 * Long Position Icon - Green upward arrow with horizontal lines
 */
export default (className?: string) => (
  <svg class={`icon-overlay ${className ?? ''}`} viewBox="0 0 22 22">
    {/* Entry line */}
    <line x1="3" y1="11" x2="19" y2="11" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2,1" />
    {/* Take profit line (above) */}
    <line x1="3" y1="5" x2="19" y2="5" stroke="#26a69a" stroke-width="1.5" />
    {/* Stop loss line (below) */}
    <line x1="3" y1="17" x2="19" y2="17" stroke="#ef5350" stroke-width="1.5" />
    {/* Up arrow */}
    <polygon points="11,3 8,9 14,9" fill="#26a69a" />
    {/* Profit zone */}
    <rect x="6" y="5" width="10" height="6" fill="#26a69a" fill-opacity="0.2" />
    {/* Loss zone */}
    <rect x="6" y="11" width="10" height="6" fill="#ef5350" fill-opacity="0.2" />
  </svg>
)
