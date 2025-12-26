/**
 * ErrorDialog - Themed fallback dialog for non-Tauri environments
 * Listens to custom events dispatched by DialogService
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './ErrorDialog.css';
import { IconAlertTriangle, IconInfo, IconX } from '../CyberpunkIcons';

type DialogType = 'info' | 'warning' | 'error';
type DialogMode = 'message' | 'confirm';

interface DialogState {
  visible: boolean;
  title: string;
  message: string;
  type: DialogType;
  mode: DialogMode;
  okLabel: string;
  cancelLabel: string;
}

interface DialogContextType {
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

const initialState: DialogState = {
  visible: false,
  title: '',
  message: '',
  type: 'info',
  mode: 'message',
  okLabel: 'OK',
  cancelLabel: 'Cancel',
};

function getIcon(type: DialogType) {
  switch (type) {
    case 'error':
      return <IconX />;
    case 'warning':
      return <IconAlertTriangle />;
    case 'info':
    default:
      return <IconInfo />;
  }
}

export const ErrorDialogProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [dialog, setDialog] = useState<DialogState>(initialState);
  const [confirmResolver, setConfirmResolver] = useState<
    ((value: boolean) => void) | null
  >(null);

  // Listen for dialog events from DialogService
  useEffect(() => {
    const handleDialogEvent = (e: CustomEvent) => {
      const { mode, title, message, type, okLabel, cancelLabel } = e.detail;
      setDialog({
        visible: true,
        title: title || getDefaultTitle(type),
        message,
        type: type || 'info',
        mode: mode || 'message',
        okLabel: okLabel || 'OK',
        cancelLabel: cancelLabel || 'Cancel',
      });
    };

    const eventName = 'ursly:dialog' as keyof WindowEventMap;
    window.addEventListener(eventName, handleDialogEvent as EventListener);
    return () =>
      window.removeEventListener(eventName, handleDialogEvent as EventListener);
  }, []);

  const closeDialog = useCallback(
    (confirmed = false) => {
      setDialog((prev) => ({ ...prev, visible: false }));

      if (dialog.mode === 'confirm' && confirmResolver) {
        confirmResolver(confirmed);
        setConfirmResolver(null);
      }

      // Dispatch response event for DialogService
      window.dispatchEvent(
        new CustomEvent('ursly:dialog-response', {
          detail: { confirmed },
        }),
      );
    },
    [dialog.mode, confirmResolver],
  );

  const handleOk = useCallback(() => closeDialog(true), [closeDialog]);
  const handleCancel = useCallback(() => closeDialog(false), [closeDialog]);

  // Context methods for direct use
  const showError = useCallback((message: string, title?: string) => {
    setDialog({
      visible: true,
      title: title || 'Error',
      message,
      type: 'error',
      mode: 'message',
      okLabel: 'OK',
      cancelLabel: 'Cancel',
    });
  }, []);

  const showWarning = useCallback((message: string, title?: string) => {
    setDialog({
      visible: true,
      title: title || 'Warning',
      message,
      type: 'warning',
      mode: 'message',
      okLabel: 'OK',
      cancelLabel: 'Cancel',
    });
  }, []);

  const showInfo = useCallback((message: string, title?: string) => {
    setDialog({
      visible: true,
      title: title || 'Information',
      message,
      type: 'info',
      mode: 'message',
      okLabel: 'OK',
      cancelLabel: 'Cancel',
    });
  }, []);

  const showConfirm = useCallback(
    (message: string, title?: string): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfirmResolver(() => resolve);
        setDialog({
          visible: true,
          title: title || 'Confirm',
          message,
          type: 'info',
          mode: 'confirm',
          okLabel: 'OK',
          cancelLabel: 'Cancel',
        });
      });
    },
    [],
  );

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dialog.visible) {
        handleCancel();
      } else if (e.key === 'Enter' && dialog.visible) {
        handleOk();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog.visible, handleOk, handleCancel]);

  return (
    <DialogContext.Provider
      value={{ showError, showWarning, showInfo, showConfirm }}
    >
      {children}
      <AnimatePresence>
        {dialog.visible && (
          <motion.div
            className="error-dialog-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancel}
          >
            <motion.div
              className={`error-dialog error-dialog-${dialog.type}`}
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="error-dialog-header">
                <div
                  className={`error-dialog-icon error-dialog-icon-${dialog.type}`}
                >
                  {getIcon(dialog.type)}
                </div>
                <h2 className="error-dialog-title">{dialog.title}</h2>
              </div>

              <div className="error-dialog-body">
                <p className="error-dialog-message">{dialog.message}</p>
              </div>

              <div className="error-dialog-footer">
                {dialog.mode === 'confirm' && (
                  <button
                    className="error-dialog-btn error-dialog-btn-cancel"
                    onClick={handleCancel}
                  >
                    {dialog.cancelLabel}
                  </button>
                )}
                <button
                  className={`error-dialog-btn error-dialog-btn-ok error-dialog-btn-${dialog.type}`}
                  onClick={handleOk}
                  autoFocus
                >
                  {dialog.okLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within an ErrorDialogProvider');
  }
  return context;
};

function getDefaultTitle(type?: DialogType): string {
  switch (type) {
    case 'error':
      return 'Error';
    case 'warning':
      return 'Warning';
    case 'info':
      return 'Information';
    default:
      return 'Message';
  }
}

export default ErrorDialogProvider;
