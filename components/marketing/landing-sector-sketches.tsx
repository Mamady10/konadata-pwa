/** Croquis SVG style main levée pour les cartes secteurs de la landing. */

interface SketchProps {
  className?: string;
}

export function SchoolSectorSketch({ className }: SketchProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M8 22 L24 10 L40 22"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="11" y="22" width="26" height="18" rx="2" stroke="currentColor" strokeWidth="2.2" />
      <path d="M22 28 h4 M22 32 h4 M22 36 h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="29" y="28" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="29" y="34" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M24 10 v-3 M24 7 l3 2 M24 7 l-3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M14 40 h20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="3 3"
        opacity="0.5"
      />
    </svg>
  );
}

export function NgoSectorSketch({ className }: SketchProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="24" cy="22" r="13" stroke="currentColor" strokeWidth="2.2" />
      <path
        d="M11 22 c4-6 10-9 13-9 s9 3 13 9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M11 22 c4 6 10 9 13 9 s9-3 13-9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M24 35 c-2.5 2-5 3-7 3 c1.5-2 2.5-4.5 2.5-7.5 c0-1.2.3-2.3.8-3.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 35 c2.5 2 5 3 7 3 c-1.5-2-2.5-4.5-2.5-7.5 c0-1.2-.3-2.3-.8-3.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 26 c-1.8-1.5-4.5-1-5.5 1.2 c-.8 1.8.5 3.8 2.8 4.2 c1.5.3 2.7-.2 3.7-1.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="21" cy="21" r="1.2" fill="currentColor" />
      <circle cx="27" cy="21" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function BtpSectorSketch({ className }: SketchProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M10 30 h28"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M14 30 v-6 l10-8 l10 8 v6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 18 h12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="20" y="22" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M30 14 l6-4 v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PmeSectorSketch({ className }: SketchProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M8 32 h32"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M12 32 v-14 l12-6 l12 6 v14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="20" y="24" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 20 h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M34 18 v-4 h-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="36" cy="16" r="2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export const SECTOR_SKETCHES = {
  school: SchoolSectorSketch,
  ngo: NgoSectorSketch,
  btp: BtpSectorSketch,
  pme: PmeSectorSketch,
} as const;
