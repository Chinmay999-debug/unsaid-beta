// Deterministic abstract gradient orb used as anonymous avatar.
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Orb({
  seed,
  size = 40,
  className = "",
  glow = true,
}: {
  seed: string;
  size?: number;
  className?: string;
  glow?: boolean;
}) {
  const h = hash(seed);
  const hue1 = h % 360;
  const hue2 = (hue1 + 40 + (h % 60)) % 360;
  const hue3 = (hue1 + 200) % 360;
  const c1 = `oklch(0.78 0.14 ${hue1})`;
  const c2 = `oklch(0.55 0.18 ${hue2})`;
  const c3 = `oklch(0.35 0.10 ${hue3})`;
  const angle = h % 360;
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 30%, ${c1}, ${c2} 55%, ${c3} 100%)`,
        boxShadow: glow ? `0 0 ${size * 0.7}px -4px ${c2}` : undefined,
        transform: `rotate(${angle}deg)`,
      }}
      className={`inline-block rounded-full shrink-0 ${className}`}
    />
  );
}
