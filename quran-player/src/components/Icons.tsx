import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const PlayIcon = (props: IconProps) => (
  <svg {...base(props)} fill="currentColor" stroke="none">
    <path d="M8 5.5v13a1 1 0 0 0 1.52.85l10.2-6.5a1 1 0 0 0 0-1.7L9.52 4.65A1 1 0 0 0 8 5.5Z" />
  </svg>
);

export const PauseIcon = (props: IconProps) => (
  <svg {...base(props)} fill="currentColor" stroke="none">
    <rect x="6.5" y="5" width="4" height="14" rx="1.4" />
    <rect x="13.5" y="5" width="4" height="14" rx="1.4" />
  </svg>
);

export const NextIcon = (props: IconProps) => (
  <svg {...base(props)} fill="currentColor" stroke="none">
    <path d="M9.5 5.2v13.6a1 1 0 0 1-1.55.83L12.6 13.3a1 1 0 0 0 0-1.66L7.95 4.37A1 1 0 0 1 9.5 5.2Z" />
    <path d="M15.2 5.2v13.6l6.4-6.8-6.4-6.8Z" />
  </svg>
);

export const PrevIcon = (props: IconProps) => (
  <svg {...base(props)} fill="currentColor" stroke="none">
    <path d="M14.5 5.2v13.6a1 1 0 0 0 1.55.83L11.4 13.3a1 1 0 0 1 0-1.66l4.65-7.27a1 1 0 0 0-1.55.83Z" />
    <path d="M8.8 5.2v13.6L2.4 12l6.4-6.8Z" />
  </svg>
);

export const BackIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const ForwardIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const SearchIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);

export const DownloadIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 4v10" />
    <path d="m8 10.5 4 4 4-4" />
    <path d="M5 18.5h14" />
  </svg>
);

export const TrashIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M5 7h14" />
    <path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
    <path d="M6.5 7l.8 11a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-11" />
  </svg>
);

export const CheckIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const AlertIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 4.5 3 19.5h18L12 4.5Z" />
    <path d="M12 10v4.5" />
    <path d="M12 17.2v.1" />
  </svg>
);

export const ListIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M8 6.5h11M8 12h11M8 17.5h11" />
    <path d="M4.6 6.5h.01M4.6 12h.01M4.6 17.5h.01" />
  </svg>
);

export const ClockIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4.4l3 1.8" />
  </svg>
);

export const XIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
  </svg>
);

export const RepeatIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M17 4.5 20 8l-3 3.5" />
    <path d="M20 8H8.5A4.5 4.5 0 0 0 4 12.5" />
    <path d="M7 19.5 4 16l3-3.5" />
    <path d="M4 16h11.5A4.5 4.5 0 0 0 20 11.5" />
  </svg>
);

export const BookIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 6.6C10.4 5.2 8.2 4.6 5 4.6v13c3.2 0 5.4.6 7 2 1.6-1.4 3.8-2 7-2v-13c-3.2 0-5.4.6-7 2Z" />
    <path d="M12 6.6v13" />
  </svg>
);

export const MoonIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />
  </svg>
);

export const SunIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
  </svg>
);

export const RefreshIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M20 12a8 8 0 1 1-2.5-5.8" />
    <path d="M20 4v5h-5" />
  </svg>
);

export const LayersIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m12 4 8 4.5-8 4.5-8-4.5L12 4Z" />
    <path d="m4 13 8 4.5 8-4.5" />
  </svg>
);
