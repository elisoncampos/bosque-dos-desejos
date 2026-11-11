/** Original decorative SVGs for the forest UI — no copyrighted art. */

export function LeafCorner({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg className={`ornament-leaf ${className}${flip ? " is-flip" : ""}`} viewBox="0 0 72 72" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 64c18-6 34-18 42-36 4-9 6-18 5-28-12 8-24 22-32 38-4 8-8 16-15 26Zm46-52c-2 10-8 20-16 28 10-4 20-12 24-22-2-2-5-4-8-6Z"
        opacity=".9"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        d="M14 58c12-10 22-24 28-40M22 48c6-4 12-12 16-20"
        opacity=".55"
      />
    </svg>
  );
}

export function VineFrame({ className = "" }: { className?: string }) {
  return (
    <svg className={`ornament-vine ${className}`} viewBox="0 0 480 40" preserveAspectRatio="none" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        d="M8 28c40-22 80-22 120 0s80 22 120 0 80-22 120 0 80 22 104 0"
        opacity=".7"
      />
      <circle cx="68" cy="16" r="3" fill="currentColor" opacity=".55" />
      <circle cx="188" cy="28" r="2.5" fill="currentColor" opacity=".45" />
      <circle cx="308" cy="14" r="3" fill="currentColor" opacity=".5" />
      <circle cx="428" cy="26" r="2.5" fill="currentColor" opacity=".45" />
    </svg>
  );
}

export function FairyMark({ className = "", size = 18 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2.5c.4 3.2 2.2 5.4 5.5 6.5-3.3 1.1-5.1 3.3-5.5 6.5-.4-3.2-2.2-5.4-5.5-6.5 3.3-1.1 5.1-3.3 5.5-6.5Z"
      />
      <circle cx="12" cy="12" r="1.6" fill="#ffe9a8" />
      <path fill="currentColor" opacity=".55" d="M4 11.2c1.8-.2 2.9-1 3.4-2.4C6.8 10.2 5.6 11 4 11.2Zm16 0c-1.8-.2-2.9-1-3.4-2.4.6 1.4 1.8 2.2 3.4 2.4Z" />
    </svg>
  );
}

export function WoodEmblem({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <ellipse cx="32" cy="34" rx="22" ry="24" fill="#3f6a4f" stroke="#d8c48a" strokeWidth="2" />
      <path fill="#e8f0c4" d="M32 12c2.4 11 6.4 15 17.5 17.5C38.4 32 34.4 36 32 47c-2.4-11-6.4-15-17.5-17.5C25.6 27 29.6 23 32 12Z" />
      <circle cx="32" cy="30" r="4" fill="#f0d878" />
    </svg>
  );
}

export function Fireflies({ count = 18 }: { count?: number }) {
  return (
    <div className="fireflies" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="firefly"
          style={{
            left: `${6 + ((i * 37) % 88)}%`,
            top: `${8 + ((i * 53) % 78)}%`,
            animationDelay: `${(i * 0.37) % 5}s`,
            animationDuration: `${4.2 + (i % 5) * 0.7}s`,
          }}
        />
      ))}
    </div>
  );
}
