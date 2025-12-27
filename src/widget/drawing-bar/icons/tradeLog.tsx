/**
 * Trade Log Icon - Book/journal icon
 */
export default (className?: string) => (
  <svg class={`icon-overlay ${className ?? ''}`} viewBox="0 0 22 22">
    {/* Book cover */}
    <path d="M4 4C4 3.44772 4.44772 3 5 3H17C17.5523 3 18 3.44772 18 4V18C18 18.5523 17.5523 19 17 19H5C4.44772 19 4 18.5523 4 18V4Z"
      fill="none" stroke="currentColor" stroke-width="1.5" />
    {/* Book spine */}
    <line x1="7" y1="3" x2="7" y2="19" stroke="currentColor" stroke-width="1.5" />
    {/* Lines representing entries */}
    <line x1="9" y1="7" x2="15" y2="7" stroke="currentColor" stroke-width="1" stroke-opacity="0.7" />
    <line x1="9" y1="10" x2="15" y2="10" stroke="currentColor" stroke-width="1" stroke-opacity="0.7" />
    <line x1="9" y1="13" x2="15" y2="13" stroke="currentColor" stroke-width="1" stroke-opacity="0.7" />
    {/* Checkmark for success */}
    <path d="M10 15L11.5 16.5L14 14" stroke="#26a69a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
)
