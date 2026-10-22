import { useEffect, useId, useRef, type ReactNode } from 'react';
import './Dialog.css';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Hide the title visually but keep it for screen readers. */
  hideTitle?: boolean;
  size?: 'sm' | 'md' | 'xl';
  children: ReactNode;
  className?: string;
}

/** A native <dialog>: focus trapping, Escape and the backdrop come from the browser. */
export function Dialog({ open, onClose, title, hideTitle, size = 'md', children, className = '' }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dlg dlg--${size} ${className}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="dlg__card">
          <div className="dlg__head">
            <h2 id={titleId} className={hideTitle ? 'visually-hidden' : 'dlg__title'}>
              {title}
            </h2>
            <button type="button" className="dlg__close" onClick={onClose}>
              <span className="visually-hidden">Close</span>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
  /** Require typing this word to enable the button. */
  typeToConfirm?: string;
  children?: ReactNode;
}

export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onClose, danger, typeToConfirm, children }: ConfirmProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  return (
    <Dialog open={open} onClose={onClose} title={title} size="sm">
      <form
        className="dlg__body dlg__confirm"
        onSubmit={(e) => {
          e.preventDefault();
          if (typeToConfirm && inputRef.current?.value.trim() !== typeToConfirm) {
            inputRef.current?.focus();
            return;
          }
          onConfirm();
        }}
      >
        <div className="dlg__text">{body}</div>
        {children}
        {typeToConfirm && (
          <label className="field" htmlFor={id}>
            <span className="field__label">
              Type <strong className="mono">{typeToConfirm}</strong> to confirm
            </span>
            <input ref={inputRef} id={id} className="input" autoComplete="off" spellCheck={false} />
          </label>
        )}
        <div className="dlg__actions">
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
