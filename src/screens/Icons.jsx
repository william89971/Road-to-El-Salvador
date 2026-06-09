// Clean minimal line-art icons — pure inline SVG, no external libraries.
// Color comes from the parent via CSS `color` (stroke="currentColor"); set it
// to white (healthy) or var(--danger) (low). Sized by the `size` prop (18 in HUD).

function Svg({ size = 18, title, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={title}
      style={{ display: 'block' }}
      {...rest}
    >
      {children}
    </svg>
  );
}

// fuel pump
export function FuelIcon(p) {
  return (
    <Svg title="Fuel" {...p}>
      <path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
      <line x1="3" y1="21" x2="15" y2="21" />
      <line x1="6" y1="10" x2="12" y2="10" />
      <path d="M14 8h2.5a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 0 1.5 1.5A1.5 1.5 0 0 0 21 16V9l-2.5-2.5" />
    </Svg>
  );
}

// side-view SUV outline
export function RigIcon(p) {
  return (
    <Svg title="Rig" {...p}>
      <path d="M2 16v-3l2-1 2-3h9l3 3 2 1v3" />
      <path d="M6 9V6h6l2 3" />
      <line x1="2" y1="16" x2="22" y2="16" />
      <circle cx="7.5" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
    </Svg>
  );
}

// three person silhouettes (crew)
export function CrewIcon(p) {
  return (
    <Svg title="Crew" {...p}>
      <circle cx="12" cy="7" r="2.4" />
      <path d="M8 19v-2a4 4 0 0 1 8 0v2" />
      <circle cx="5" cy="9" r="1.8" />
      <path d="M2 18v-1.5a3 3 0 0 1 3-3" />
      <circle cx="19" cy="9" r="1.8" />
      <path d="M22 18v-1.5a3 3 0 0 0-3-3" />
    </Svg>
  );
}

// banknote with a $ stroke
export function CashIcon(p) {
  return (
    <Svg title="Cash" {...p}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M14 9.2a2 2 0 0 0-2-0.7c-1 0-1.8.6-1.8 1.4 0 2 3.6 1 3.6 3.1 0 .9-.9 1.5-1.8 1.5a2.1 2.1 0 0 1-2-0.8" />
      <line x1="12" y1="7.6" x2="12" y2="16.4" />
    </Svg>
  );
}

// bitcoin ₿ as a stroke icon
export function BtcIcon(p) {
  return (
    <Svg title="Bitcoin" {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 7.5v9M11.5 6v1.5M11.5 16.5V18M9.5 12h4a2 2 0 0 0 0-4h-4M9.5 12h4.3a2.2 2.2 0 0 1 0 4.4H9.5" />
    </Svg>
  );
}

// pause (two bars)
export function PauseIcon(p) {
  return (
    <Svg title="Pause" {...p}>
      <line x1="8" y1="5" x2="8" y2="19" />
      <line x1="16" y1="5" x2="16" y2="19" />
    </Svg>
  );
}

// play (triangle) — for the resume state
export function PlayIcon(p) {
  return (
    <Svg title="Play" {...p}>
      <path d="M7 5l12 7-12 7z" />
    </Svg>
  );
}

// speaker, with a slash when muted
export function MuteIcon({ muted, ...p }) {
  return (
    <Svg title={muted ? 'Muted' : 'Sound'} {...p}>
      <path d="M4 9v6h3l4 4V5L7 9H4z" />
      {muted ? (
        <>
          <line x1="16" y1="9" x2="21" y2="14" />
          <line x1="21" y1="9" x2="16" y2="14" />
        </>
      ) : (
        <>
          <path d="M16 8.5a4 4 0 0 1 0 7" />
          <path d="M18.5 6a7 7 0 0 1 0 12" />
        </>
      )}
    </Svg>
  );
}

// location pin (map)
export function MapIcon(p) {
  return (
    <Svg title="Map" {...p}>
      <path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </Svg>
  );
}
