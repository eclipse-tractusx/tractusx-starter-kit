import type { SVGProps } from "react";

/** Stroke icons on a 24 px grid, drawn for this site. Add one by adding a path. */
const paths = {
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  check: "M5 12.5l4.5 4.5L19 7",
  copy: "M9 9h10v10H9zM5 15V5h10",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  external: "M14 5h5v5M19 5l-8 8M18 14v5H5V6h5",
  plus: "M12 5v14M5 12h14",
  trash: "M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12",
  x: "M6 6l12 12M18 6L6 18",
  info: "M12 11v6M12 7.5v.01M12 21a9 9 0 100-18 9 9 0 000 18z",
  alert: "M12 9v4M12 16.5v.01M10.3 4.2L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 4.2a2 2 0 00-3.4 0z",
  sun: "M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z",
  github:
    "M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 00-1.3-3.2 4.2 4.2 0 00-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 00-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 00-.1 3.2A4.6 4.6 0 004 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21",
  file: "M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5",
  folder: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5",
  container: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",
  helm: "M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.9 2.9M15.5 15.5l2.9 2.9M5.6 18.4l2.9-2.9M15.5 8.5l2.9-2.9M12 16a4 4 0 100-8 4 4 0 000 8z",
  toolbox: "M3 9h18v10H3zM8 9V6a1 1 0 011-1h6a1 1 0 011 1v3M3 13h18M10 13v2h4v-2",
  terminal: "M4 5h16v14H4zM8 10l2 2-2 2M12 14h4",
  users: "M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 19v-1a4 4 0 00-3-3.9M15.5 3.1a3.5 3.5 0 010 6.8",
  sliders: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4",
  tag: "M3 12V4h8l10 10-8 8zM7.5 8.5v.01",
  sparkles: "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z",
  database: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  network: "M12 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM19 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM12 8v4M12 12l-5.5 4.5M12 12l5.5 4.5",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  key: "M15 7a4 4 0 11-3.5 6L4 20.5V17h3v-3h3l1.5-1.5A4 4 0 0115 7zM16 8v.01",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5",
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 6l6 6-6 6",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3",
} as const;

export type IconName = keyof typeof paths;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  /** A label makes the icon meaningful to screen readers; without one it is decorative. */
  label?: string;
}

export function Icon({ name, size = 18, label, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  );
}
