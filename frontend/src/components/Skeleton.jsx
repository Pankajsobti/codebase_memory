/**
 * Shared loading indicator, replaces ad-hoc inline spinner <div>s.
 * variant="spinner" -> circular spinner with optional label (default)
 * variant="block"   -> shimmering placeholder block (for text/row loaders)
 */
export default function Skeleton({ variant = 'spinner', label, size = 28, width, height }) {
  if (variant === 'block') {
    return (
      <div
        style={{
          width: width || '100%',
          height: height || 16,
          borderRadius: 'var(--radius-sm)',
          background:
            'linear-gradient(90deg, var(--color-bg-subtle) 25%, var(--color-border) 37%, var(--color-bg-subtle) 63%)',
          backgroundSize: '400% 100%',
          animation: 'skeleton-shimmer 1.4s ease infinite',
        }}
      >
        <style>{`@keyframes skeleton-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }`}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        color: 'var(--color-text-muted)',
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-accent)',
          borderRadius: '50%',
          animation: 'skeleton-spin 0.8s linear infinite',
        }}
      />
      {label && <span style={{ fontSize: 'var(--font-md)' }}>{label}</span>}
      <style>{`@keyframes skeleton-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
