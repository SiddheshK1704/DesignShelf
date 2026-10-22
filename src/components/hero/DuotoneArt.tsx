import { useId } from 'react';
import type { ArtVariant } from '../../lib/heroRefs';

/**
 * Flat placeholder illustrations built from a reference's three swatches.
 * Drawn in a 100x100 box and cropped to the tile, so key shapes stay
 * inside x 12–88.
 */
export function DuotoneArt({ variant, colors }: { variant: ArtVariant; colors: [string, string, string] }) {
  const [c0, c1, c2] = colors;
  const uid = useId().replace(/:/g, '');

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="duotone">
      {variant === 'cup' && (
        <>
          <rect width="100" height="100" fill={c0} />
          <rect y="74" width="100" height="26" fill={c1} opacity="0.08" />
          <ellipse cx="50" cy="77" rx="23" ry="2.6" fill="#000" opacity="0.35" />
          <path d="M68 47a8 8 0 0 1 0 15" fill="none" stroke={c1} strokeWidth="4" />
          <path d="M32 40h36v22a14 14 0 0 1-14 14h-8a14 14 0 0 1-14-14z" fill={c1} />
          <path d="M56 40h12v22a14 14 0 0 1-14 14h-2a14 14 0 0 0 4-10z" fill={c2} opacity="0.45" />
          <ellipse cx="50" cy="40" rx="18" ry="3.4" fill={c2} />
          <rect x="36" y="45" width="2.5" height="20" rx="1.25" fill="#fff" opacity="0.2" />
        </>
      )}

      {variant === 'cluster' && (
        <>
          <rect width="100" height="100" fill={c0} />
          {[33, 67].map((cx, i) => (
            <g key={cx}>
              <circle cx={cx} cy="52" r="17" fill="none" stroke={c1} strokeOpacity="0.55" strokeWidth="1.1" />
              <circle cx={cx} cy="52" r="13.5" fill="none" stroke={c1} strokeWidth="2.2" strokeDasharray="0.6 2.6" />
              <line
                x1={cx}
                y1="52"
                x2={cx + 12 * Math.cos(i ? -0.5 : 2.4)}
                y2={52 + 12 * Math.sin(i ? -0.5 : 2.4) * -1}
                stroke={c2}
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <circle cx={cx} cy="52" r="2" fill={c1} />
            </g>
          ))}
          <rect x="44" y="27" width="12" height="3" fill={c2} opacity="0.85" />
          <rect x="18" y="80" width="64" height="0.8" fill={c1} opacity="0.35" />
        </>
      )}

      {variant === 'sideboard' && (
        <>
          <rect width="100" height="100" fill={c1} />
          <rect y="80" width="100" height="20" fill={c0} opacity="0.12" />
          <rect x="26" y="14" width="20" height="16" fill="none" stroke={c0} strokeOpacity="0.45" strokeWidth="0.8" />
          <rect x="63" y="29" width="6" height="12" rx="3" fill={c0} />
          <rect x="15" y="41" width="70" height="2" fill={c0} />
          <rect x="16" y="43" width="68" height="23" fill={c2} />
          <path d="M38.7 43v23M61.3 43v23" stroke={c0} strokeOpacity="0.55" strokeWidth="0.6" />
          <path d="M21 66l-2 14M79 66l2 14" stroke={c0} strokeWidth="1.3" />
          <ellipse cx="50" cy="80.5" rx="34" ry="1.2" fill="#000" opacity="0.18" />
        </>
      )}

      {variant === 'dial' && (
        <>
          <rect width="100" height="100" fill={c0} />
          <circle cx="53" cy="54" r="31" fill="#000" opacity="0.3" />
          <circle cx="50" cy="50" r="30" fill="none" stroke={c1} strokeWidth="5" strokeDasharray="0.7 0.7" opacity="0.75" />
          <circle cx="50" cy="50" r="27" fill={c1} />
          {[23, 19, 15, 11].map((r) => (
            <circle key={r} cx="50" cy="50" r={r} fill="none" stroke={c0} strokeOpacity="0.14" strokeWidth="0.4" />
          ))}
          <circle cx="50" cy="50" r="3.2" fill={c0} opacity="0.25" />
          <rect x="49.2" y="26" width="1.6" height="12" fill={c2} />
        </>
      )}

      {variant === 'tote' && (
        <>
          <rect width="100" height="100" fill={c2} />
          <ellipse cx="50" cy="83" rx="33" ry="2.4" fill="#000" opacity="0.22" />
          <path d="M38 44C38 21 62 21 62 44" fill="none" stroke={c0} strokeWidth="2.6" />
          <path d="M26 44h48l6 38H20z" fill={c1} />
          <path d="M26 44h48l-1.5 10h-45z" fill={c0} opacity="0.28" />
          <path d="M29 58h42" stroke={c2} strokeWidth="0.6" strokeDasharray="1.5 1.5" opacity="0.8" />
          <rect x="47" y="52" width="6" height="5" fill={c0} opacity="0.6" />
        </>
      )}

      {variant === 'poster' && (
        <>
          <rect width="100" height="100" fill={c0} />
          <rect x="14" y="14" width="44" height="44" fill={c1} />
          {[14, 19, 24, 29, 34].map((y) => (
            <rect key={y} x="63" y={y} width="23" height="1.5" fill={c2} opacity="0.7" />
          ))}
          <rect x="14" y="64" width="54" height="8" fill={c2} />
          <rect x="14" y="75" width="32" height="3" fill={c2} />
          <circle cx="76" cy="82" r="7" fill="none" stroke={c2} strokeWidth="1" />
        </>
      )}

      {variant === 'speaker' && (
        <>
          <defs>
            <pattern id={`knit-${uid}`} width="3" height="3" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="0.75" fill={c0} opacity="0.28" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill={c0} />
          <ellipse cx="50" cy="84" rx="28" ry="2.4" fill="#000" opacity="0.4" />
          <rect x="24" y="18" width="52" height="65" rx="15" fill={c1} />
          <rect x="24" y="18" width="52" height="65" rx="15" fill={`url(#knit-${uid})`} />
          <rect x="62" y="18" width="14" height="65" rx="7" fill="#000" opacity="0.08" />
          <circle cx="50" cy="27" r="2" fill={c2} />
        </>
      )}

      {variant === 'stair' && (
        <>
          <rect width="100" height="100" fill={c2} />
          <path d="M100 0L58 0L100 42z" fill="#fff" opacity="0.18" />
          <path d="M0 100V72h20V60h20V48h20V36h20V24h20v76z" fill={c1} />
          <path d="M20 72v-12M40 60V48M60 48V36M80 36V24" stroke={c0} strokeWidth="1.4" opacity="0.6" />
          {[78, 84, 90].map((y) => (
            <rect key={y} y={y} width="100" height="0.5" fill={c0} opacity="0.18" />
          ))}
          <rect y="94" width="100" height="6" fill={c0} />
        </>
      )}

      {variant === 'phone' && (
        <>
          <rect width="100" height="100" fill={c0} />
          <rect x="29" y="8" width="42" height="84" rx="7" fill={c1} />
          <rect x="34" y="19" width="32" height="15" rx="2" fill={c2} />
          <rect x="34" y="39" width="18" height="3" rx="1" fill={c0} opacity="0.75" />
          <rect x="34" y="45" width="27" height="1.6" rx="0.8" fill={c0} opacity="0.3" />
          {[53, 59, 65].map((y) => (
            <rect key={y} x="34" y={y} width="32" height="4" rx="1" fill={c0} opacity="0.08" />
          ))}
          <rect x="34" y="79" width="32" height="7" rx="3.5" fill={c0} />
        </>
      )}
    </svg>
  );
}
