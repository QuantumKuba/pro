/**
 * Forecast Line Icon - Dashed diagonal line with arrow pointing to future
 */
export default (className?: string) => (
  <svg class={`icon-overlay ${className ?? ''}`} viewBox="0 0 22 22">
    {/* Main forecast line (dashed) */}
    <line x1="4" y1="16" x2="16" y2="6" stroke="#9C27B0" stroke-width="2" stroke-dasharray="3,2" />
    {/* Arrow head */}
    <polygon points="18,5 14,5 16,9" fill="#9C27B0" />
    {/* Start point */}
    <circle cx="4" cy="16" r="2" fill="#9C27B0" />
    {/* Confidence cone lines (fainter) */}
    <line x1="4" y1="16" x2="16" y2="4" stroke="#9C27B0" stroke-width="1" stroke-opacity="0.3" stroke-dasharray="2,2" />
    <line x1="4" y1="16" x2="16" y2="8" stroke="#9C27B0" stroke-width="1" stroke-opacity="0.3" stroke-dasharray="2,2" />
  </svg>
)
