const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.8,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
} as const;

export const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

export const ListIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
    <path d="M9 6h12M9 12h12M9 18h12" />
    <circle cx="4.5" cy="6" r="1" />
    <circle cx="4.5" cy="12" r="1" />
    <circle cx="4.5" cy="18" r="1" />
  </svg>
);

export const ClockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const SlidersIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);

export const PlusIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke} stroke-width={1.6}>
    <path d="M12 4v16M4 12h16" />
  </svg>
);

export const SearchIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke} stroke-width={2.2}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5 21 21" />
  </svg>
);

export const ChevronRight = () => (
  <svg class="chev" viewBox="0 0 8 14" aria-hidden="true" {...stroke} stroke-width={2}>
    <path d="M1 1l6 6-6 6" />
  </svg>
);

export const ChevronLeft = () => (
  <svg viewBox="0 0 12 22" aria-hidden="true" style={{ width: '12px', height: '22px' }} {...stroke} stroke-width={2.6}>
    <path d="M10 2 2 11l8 9" />
  </svg>
);

export const CheckIcon = () => (
  <svg viewBox="0 0 12 12" aria-hidden="true" {...stroke} stroke-width={2}>
    <path d="M2 6.5 5 9.5 10 3" />
  </svg>
);
