/**
 * Decorative illustration for class banners and cards, in the spirit of Google Classroom's
 * header art: a large soft circle with open books and a pencil. Drawn in translucent
 * white/black so it sits on any class colour. `variant` (from the class id) varies the scene.
 */
export default function ClassArt({ variant = 0, height = '100%' }: { variant?: number; height?: number | string }) {
  const v = Math.abs(variant) % 3;
  return (
    <svg className="class-art" viewBox="0 0 420 240" height={height} preserveAspectRatio="xMaxYMid meet" aria-hidden
      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, pointerEvents: 'none' }}>
      <circle cx="400" cy="250" r="230" fill="rgba(0,0,0,.14)" />
      {v === 0 && (
        <g>
          {/* open book */}
          <g transform="translate(150 40) rotate(-28)">
            <rect x="0" y="0" width="120" height="150" rx="6" fill="rgba(255,255,255,.78)" />
            <rect x="120" y="0" width="120" height="150" rx="6" fill="rgba(255,255,255,.68)" />
            {[26, 46, 66, 86, 106].map((y) => <rect key={y} x="16" y={y} width="88" height="5" rx="2.5" fill="rgba(0,0,0,.12)" />)}
            {[26, 46, 66, 86].map((y) => <rect key={y} x="136" y={y} width="88" height="5" rx="2.5" fill="rgba(0,0,0,.1)" />)}
          </g>
          {/* closed books */}
          <rect x="300" y="10" width="80" height="120" rx="6" transform="rotate(12 340 70)" fill="rgba(255,255,255,.35)" />
          <rect x="330" y="70" width="80" height="130" rx="6" transform="rotate(-8 370 135)" fill="rgba(0,0,0,.18)" />
          <rect x="352" y="80" width="10" height="120" transform="rotate(-8 370 135)" fill="rgba(220,40,80,.8)" />
          {/* pencil */}
          <g transform="translate(150 150) rotate(-40)">
            <rect x="0" y="0" width="110" height="10" rx="3" fill="#f59e0b" />
            <polygon points="110,0 124,5 110,10" fill="#fde68a" />
            <rect x="-10" y="0" width="12" height="10" rx="2" fill="#fb7185" />
          </g>
        </g>
      )}
      {v === 1 && (
        <g>
          {/* backpack */}
          <rect x="250" y="40" width="130" height="170" rx="34" fill="rgba(255,255,255,.35)" />
          <rect x="270" y="120" width="90" height="70" rx="16" fill="rgba(255,255,255,.3)" />
          <rect x="290" y="20" width="50" height="34" rx="14" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="8" />
          <rect x="220" y="70" width="70" height="100" rx="8" transform="rotate(-12 255 120)" fill="rgba(160,210,120,.8)" />
          <rect x="232" y="84" width="46" height="6" rx="3" transform="rotate(-12 255 120)" fill="rgba(0,0,0,.15)" />
          <g transform="translate(150 70) rotate(35)">
            <rect x="0" y="0" width="100" height="10" rx="4" fill="rgba(255,255,255,.9)" />
            <polygon points="100,0 114,5 100,10" fill="#94a3b8" />
          </g>
          <rect x="140" y="40" width="40" height="18" rx="9" transform="rotate(-30 160 49)" fill="#fda4af" />
        </g>
      )}
      {v === 2 && (
        <g>
          {/* stacked books and a globe-like circle */}
          <circle cx="330" cy="70" r="46" fill="rgba(255,255,255,.35)" />
          <path d="M290 70 h80 M330 24 v92" stroke="rgba(0,0,0,.18)" strokeWidth="5" />
          <rect x="210" y="150" width="180" height="26" rx="5" fill="rgba(255,255,255,.7)" />
          <rect x="225" y="124" width="160" height="26" rx="5" fill="rgba(0,0,0,.2)" />
          <rect x="200" y="176" width="190" height="26" rx="5" fill="rgba(255,255,255,.45)" />
          <rect x="235" y="124" width="8" height="26" fill="rgba(250,204,21,.9)" />
          <g transform="translate(150 120) rotate(-20)">
            <rect x="0" y="0" width="70" height="9" rx="3" fill="#f59e0b" />
            <polygon points="70,0 82,4.5 70,9" fill="#fde68a" />
          </g>
        </g>
      )}
    </svg>
  );
}

/** Stable small number from an id, to pick an art variant. */
export function artVariant(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}
