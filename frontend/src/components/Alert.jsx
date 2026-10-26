import { AlertCircle, RotateCcw, X } from 'lucide-react';

export default function Alert({ message, onRetry, onDismiss, retryLabel = 'Retry' }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-error-border)',
        background: 'var(--color-error-bg)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <AlertCircle
        size={16}
        strokeWidth={2}
        color="var(--color-error)"
        style={{ flexShrink: 0, marginTop: 2 }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--font-md)',
            color: 'var(--color-text)',
            lineHeight: 1.45,
            wordBreak: 'break-word',
          }}
        >
          {message}
        </p>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              marginTop: 'var(--space-3)',
              padding: 'var(--space-1) var(--space-4)',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-error-border)',
              background: 'transparent',
              color: 'var(--color-error)',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: `background var(--transition-fast), color var(--transition-fast)`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-error)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--color-error)';
            }}
          >
            <RotateCcw size={12} strokeWidth={2} />
            {retryLabel}
          </button>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            padding: 0,
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={14} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
