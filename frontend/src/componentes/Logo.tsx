export function Logo({ tamano = 36 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#FFCB35" />
      <g fill="none" stroke="#003B68" strokeWidth="3.4" strokeLinecap="round">
        <circle cx="32" cy="32" r="11.5" />
        <path d="M32 14.5v6.2M32 43.3v6.2M14.5 32h6.2M43.3 32h6.2" />
      </g>
      <rect x="29.2" y="29.2" width="5.6" height="5.6" rx="1.1" fill="#003B68" />
    </svg>
  );
}
