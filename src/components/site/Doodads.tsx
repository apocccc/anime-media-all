/**
 * コミック風の小さな装飾(星・「!!」・紙吹雪)。
 * すべてマット単色+輪郭線のみ。影・グラデーション不使用(装飾は aria-hidden)。
 */

export function StarSpark({
  size = 22,
  color = "#fad157",
  className = "",
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
    >
      <path
        d="M12 1 L14.6 9.4 L23 12 L14.6 14.6 L12 23 L9.4 14.6 L1 12 L9.4 9.4 Z"
        fill={color}
        stroke="#141d28"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Star5({
  size = 26,
  color = "#139a9f",
  className = "",
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
    >
      <path
        d="M12 1.6 l3 6.5 7 .9 -5.1 4.9 1.3 7 -6.2 -3.4 -6.2 3.4 1.3 -7 -5.1 -4.9 7 -.9 Z"
        fill={color}
        stroke="#141d28"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Bang({
  size = 26,
  color = "#141d28",
  className = "",
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 26 26"
      className={className}
    >
      <g fill={color}>
        <path d="M6 2 l5 1 -2.4 13 -3.6 -.6 Z" transform="rotate(-8 8 9)" />
        <rect x="6.4" y="19" width="4.2" height="4.2" rx="1" transform="rotate(-8 8 21)" />
        <path d="M16 2 l5 1 -2.4 13 -3.6 -.6 Z" transform="rotate(6 18 9)" />
        <rect x="16.6" y="19" width="4.2" height="4.2" rx="1" transform="rotate(6 18 21)" />
      </g>
    </svg>
  );
}

export function ConfettiDot({
  size = 10,
  color = "#fffdf9",
  className = "",
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block rounded-full border-2 border-ink ${className}`}
      style={{ width: size, height: size, background: color }}
    />
  );
}

export function Crown({
  size = 26,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 26 22"
      className={className}
    >
      <path
        d="M2 6 L8 11 L13 3 L18 11 L24 6 L21.5 18 L4.5 18 Z"
        fill="#fad157"
        stroke="#141d28"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Heart({
  size = 22,
  color = "#eb4e5d",
  className = "",
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 22"
      className={className}
    >
      <path
        d="M12 20 C4 14 1.5 9.5 3.5 5.6 C5.3 2.2 10 2.6 12 6 C14 2.6 18.7 2.2 20.5 5.6 C22.5 9.5 20 14 12 20 Z"
        fill={color}
        stroke="#141d28"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
