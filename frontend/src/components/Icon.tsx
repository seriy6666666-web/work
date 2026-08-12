export type IconName =
  | 'grid'
  | 'box'
  | 'shuffle'
  | 'checklist'
  | 'users'
  | 'bar-chart'
  | 'swap'
  | 'calendar-x'
  | 'building'
  | 'list'
  | 'warning'
  | 'star'
  | 'log-out'
  | 'refresh'
  | 'inbox'
  | 'message'
  | 'search'
  | 'menu'
  | 'x'
  | 'moon'
  | 'sun'
  | 'sort'
  | 'download'
  | 'bell'
  | 'wrench'
  | 'layers'
  | 'calendar'
  | 'check';

const PATHS: Record<IconName, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  box: (
    <>
      <path d="M3 8l9-5 9 5-9 5-9-5z" />
      <path d="M3 8v9l9 5 9-5V8" />
      <path d="M12 13v9" />
    </>
  ),
  shuffle: (
    <>
      <path d="M3 6h4l10 12h4" />
      <path d="M17 4l4 2-4 2" />
      <path d="M3 18h4l4-4.5" />
      <path d="M13 8.5L15 6" />
      <path d="M17 20l4-2-4-2" />
    </>
  ),
  checklist: (
    <>
      <path d="M4 6h9" />
      <path d="M4 12h9" />
      <path d="M4 18h6" />
      <path d="M16 5l2 2 3-3" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <circle cx="17.5" cy="9" r="2.4" />
      <path d="M15.5 14.2c2.6.3 4.5 2.4 4.5 5.3" />
    </>
  ),
  'bar-chart': (
    <>
      <rect x="4" y="12" width="4" height="8" rx="1" />
      <rect x="10" y="7" width="4" height="13" rx="1" />
      <rect x="16" y="3" width="4" height="17" rx="1" />
    </>
  ),
  swap: (
    <>
      <path d="M4 8h13" />
      <path d="M13 4l4 4-4 4" />
      <path d="M20 16H7" />
      <path d="M11 12l-4 4 4 4" />
    </>
  ),
  'calendar-x': (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
      <path d="M9.5 14.5l5 5M14.5 14.5l-5 5" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="9" width="7" height="12" rx="1" />
      <rect x="13" y="3" width="7" height="18" rx="1" />
      <path d="M7 13h1M7 17h1M16 7h1M16 11h1M16 15h1" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 10v4" />
      <path d="M12 17.5h.01" />
    </>
  ),
  star: <path d="M12 3l2.6 5.9 6.4.6-4.8 4.3 1.4 6.3-5.6-3.4-5.6 3.4 1.4-6.3-4.8-4.3 6.4-.6z" />,
  'log-out': (
    <>
      <path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4" />
      <path d="M10 8l-5 4 5 4" />
      <path d="M5 12h13" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11A8 8 0 106.3 17.7" />
      <path d="M20 5v6h-6" />
    </>
  ),
  message: (
    <>
      <path d="M21 12a8 8 0 01-8 8H7l-4 3v-5.5A8 8 0 1121 12z" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 12h5l2 3h4l2-3h5" />
      <path d="M5 5h14l2 7v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6l2-7z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  menu: (
    <>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </>
  ),
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  sort: (
    <>
      <path d="M8 4v16" />
      <path d="M5 8l3-4 3 4" />
      <path d="M16 20V4" />
      <path d="M13 16l3 4 3-4" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 21h16" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 01-3.4 0" />
    </>
  ),
  check: <path d="M20 6L9 17l-5-5" />,
  wrench: (
    <path d="M14.7 6.3a4 4 0 00-5.2 5.2l-6.1 6.1a1.5 1.5 0 002.1 2.1l6.1-6.1a4 4 0 005.2-5.2l-2.5 2.5-2.1-2.1 2.5-2.5z" />
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
    </>
  ),
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
