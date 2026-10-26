import { useEffect } from 'react';

/**
 * Small top-right auto-dismissing toast, meant to replace ad-hoc inline
 * error <p> tags. Purely presentational — callers keep owning their own
 * error state and pass it in as `message`; `onDismiss` should clear that
 * state (e.g. `() => setError(null)`).
 */
export default function Toast({ message, onDismiss, duration = 4000 }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => {
      onDismiss?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 'var(--space-5)',
        right: 'var(--space-5)',
        zIndex: 1000,
        maxWidth: 340,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-2)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-error-bg)',
        border: '1px solid var(--color-error-border)',
        color: 'var(--color-error)',
        boxShadow: 'var(--shadow-md)',
        fontSize: 'var(--font-md)',
        lineHeight: 1.4,
        backdropFilter: 'blur(6px)',
        transition: `opacity var(--transition-fast), transform var(--transition-fast)`,
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--color-error)',
          cursor: 'pointer',
          fontSize: 'var(--font-lg)',
          lineHeight: 1,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
