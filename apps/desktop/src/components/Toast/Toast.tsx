/**
 * Toast - Notification component for action confirmations
 *
 * Displays brief, non-blocking notifications for keyboard shortcuts
 * and other actions. Uses global CSS variables for theming.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
} from 'react';
import './Toast.css';

// Toast types with semantic meaning
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'action';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  shortcut?: string; // Optional keyboard shortcut display
  duration?: number; // Auto-dismiss duration in ms (default: 2000)
  icon?: React.ReactNode;
}

interface ToastContextType {
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  showActionToast: (action: string, shortcut?: string) => void;
  dismissToast: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

/**
 * Hook to access toast functionality
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

/**
 * Toast Provider - Manages toast state and provides context
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastMessage = {
      ...toast,
      id,
      duration: toast.duration ?? 2000,
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, newToast.duration);
    }
  }, []);

  const showActionToast = useCallback(
    (action: string, shortcut?: string) => {
      showToast({
        type: 'action',
        message: action,
        shortcut,
        duration: 1500,
      });
    },
    [showToast],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider
      value={{ toasts, showToast, showActionToast, dismissToast, clearAll }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

/**
 * Toast Container - Renders all active toasts
 */
function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

/**
 * Individual Toast Item
 */
function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  }, [toast.id, onDismiss]);

  // Get icon based on type
  const getIcon = () => {
    if (toast.icon) return toast.icon;

    switch (toast.type) {
      case 'success':
        return (
          <svg viewBox="0 0 16 16" fill="currentColor" className="toast-icon">
            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
          </svg>
        );
      case 'error':
        return (
          <svg viewBox="0 0 16 16" fill="currentColor" className="toast-icon">
            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
          </svg>
        );
      case 'warning':
        return (
          <svg viewBox="0 0 16 16" fill="currentColor" className="toast-icon">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
          </svg>
        );
      case 'info':
        return (
          <svg viewBox="0 0 16 16" fill="currentColor" className="toast-icon">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm1.5 8.5h-3v-1h1V8h-1V7h2v4.5h1v1z" />
          </svg>
        );
      case 'action':
        return (
          <svg viewBox="0 0 16 16" fill="currentColor" className="toast-icon">
            <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z" />
            <path d="M11.5 4a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V5h-2.5a.5.5 0 0 1 0-1h3zm-7 8a.5.5 0 0 1-.5-.5v-3a.5.5 0 0 1 1 0V11h2.5a.5.5 0 0 1 0 1h-3z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`toast toast-${toast.type} ${isExiting ? 'toast-exit' : ''}`}
      role="alert"
      onClick={handleDismiss}
    >
      <div className="toast-content">
        {getIcon()}
        <span className="toast-message">{toast.message}</span>
        {toast.shortcut && (
          <kbd className="toast-shortcut">{toast.shortcut}</kbd>
        )}
      </div>
    </div>
  );
}

export default ToastProvider;
