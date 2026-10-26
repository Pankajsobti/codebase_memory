import { useEffect } from 'react';
import './ConfirmDialog.css';

/**
 * Apple-style confirmation sheet — frosted backdrop, SF-style type,
 * hairline-divided action row. Replaces window.confirm().
 *
 * Usage:
 *  <ConfirmDialog
 *    open={pendingDeleteId !== null}
 *    title="Delete this repo?"
 *    message="This can't be undone. All parsed files and graph data will be removed."
 *    confirmLabel="Delete"
 *    onConfirm={...}
 *    onCancel={...}
 *  />
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div className="confirm-backdrop" onClick={onCancel}>
      <div
        className="confirm-sheet"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-sheet__body">
          <h2 id="confirm-title" className="confirm-sheet__title">{title}</h2>
          {message && <p className="confirm-sheet__message">{message}</p>}
        </div>

        <div className="confirm-sheet__actions">
          <button type="button" className="confirm-sheet__btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-sheet__btn confirm-sheet__btn--primary ${
              destructive ? 'confirm-sheet__btn--destructive' : ''
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}