/**
 * OnboardingTour Component
 * Provides a step-by-step guided tour of the application features
 * Uses react-joyride for smooth, accessible onboarding experience
 */
import { useState, useEffect, useCallback } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import './OnboardingTour.css';

interface OnboardingTourProps {
  /** Whether to show the tour automatically on first visit */
  autoStart?: boolean;
  /** Callback when tour completes */
  onComplete?: () => void;
  /** Callback when tour is skipped */
  onSkip?: () => void;
}

// Define tour steps
const TOUR_STEPS: Step[] = [
  {
    target: '.action-pill.search',
    content: (
      <div>
        <h3>Search</h3>
        <p>
          Press <kbd>Cmd+K</kbd> (Mac) or <kbd>Ctrl+K</kbd> (Windows/Linux) to
          open Spotlight Search. Instantly find files, folders, and tags across
          all your storage sources. Use powerful operators like{' '}
          <code>tag:</code>, <code>type:</code>, <code>ext:</code>, and{' '}
          <code>size:</code> to filter results.
        </p>
      </div>
    ),
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '.header-tab[data-tab="metrics"]',
    content: (
      <div>
        <h3>Metrics</h3>
        <p>
          Monitor system performance, GPU usage, and storage statistics in
          real-time. Track resource consumption across all your connected
          storage sources and optimize your workflow.
        </p>
      </div>
    ),
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '.action-pill.shortcuts',
    content: (
      <div>
        <h3>Keyboard Shortcuts</h3>
        <p>
          Ursly VFS is keyboard-first for maximum productivity. Press{' '}
          <kbd>?</kbd> to view all available shortcuts. Navigate, search, and
          manage files without touching your mouse.
        </p>
      </div>
    ),
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '.favorites-section',
    content: (
      <div>
        <h3>Favorites</h3>
        <p>
          Quickly access your most-used files and folders. Drag any file or
          folder here to add it to favorites, or right-click and select "Add to
          Favorites". Your favorites sync across all devices.
        </p>
      </div>
    ),
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '.file-browser',
    content: (
      <div>
        <h3>Asset Management</h3>
        <p>
          Organize your files with tags, metadata, and smart filters.
          Right-click any file to view details, add tags, or manage properties.
          Use <kbd>Cmd+I</kbd> (Mac) or <kbd>Ctrl+I</kbd> (Windows/Linux) to
          open asset details. Tags help you organize and find files across all
          storage sources.
        </p>
      </div>
    ),
    placement: 'right',
    disableBeacon: true,
  },
];

const STORAGE_KEY = 'ursly-onboarding-completed';

// Global state for tour control
let tourStateRef: {
  setRun: (run: boolean) => void;
  setStepIndex: (index: number) => void;
} | null = null;

export function OnboardingTour({
  autoStart = false,
  onComplete,
  onSkip,
}: OnboardingTourProps) {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Store ref for external control
  useEffect(() => {
    tourStateRef = { setRun, setStepIndex };
    return () => {
      tourStateRef = null;
    };
  }, []);

  // Check if user has completed onboarding
  useEffect(() => {
    const hasCompleted = localStorage.getItem(STORAGE_KEY) === 'true';
    if (autoStart && !hasCompleted) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        setRun(true);
      }, 1000);
    }
  }, [autoStart]);

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { status, type, index } = data;

      // Handle tour completion, skipping, or closing (Escape/X button)
      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        setRun(false);
        localStorage.setItem(STORAGE_KEY, 'true');

        if (status === STATUS.FINISHED) {
          onComplete?.();
        } else {
          // Handle skip or close (Escape/X button triggers SKIPPED status)
          onSkip?.();
        }
      } else if (type === 'step:after' || type === 'error:target_not_found') {
        setStepIndex(index);
      }
    },
    [onComplete, onSkip],
  );

  return (
    <>
      <Joyride
        steps={TOUR_STEPS}
        run={run}
        stepIndex={stepIndex}
        continuous
        showProgress
        showSkipButton
        disableCloseOnEsc={false}
        hideCloseButton={false}
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: 'var(--primary, #0a84ff)',
            textColor: 'var(--text-primary, #f5f5f7)',
            backgroundColor: 'var(--surface, #3a3a3c)',
            overlayColor: 'rgba(0, 0, 0, 0.6)',
            arrowColor: 'var(--surface, #3a3a3c)',
            zIndex: 10001,
          },
          tooltip: {
            borderRadius: '12px',
            padding: '20px',
            fontFamily:
              'var(--font-sans, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif)',
          },
          tooltipContainer: {
            textAlign: 'left',
          },
          tooltipTitle: {
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '8px',
            color: 'var(--text-primary, #f5f5f7)',
          },
          tooltipContent: {
            fontSize: '14px',
            lineHeight: '1.5',
            color: 'var(--text-secondary, #a1a1a6)',
            padding: '8px 0',
          },
          buttonNext: {
            backgroundColor: 'var(--primary, #0a84ff)',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
          },
          buttonBack: {
            color: 'var(--text-secondary, #a1a1a6)',
            fontSize: '14px',
            marginRight: '8px',
            padding: '10px 20px',
            borderRadius: '8px',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
            backgroundColor: 'transparent',
            cursor: 'pointer',
          },
          buttonSkip: {
            color: 'var(--text-muted, #8e8e93)',
            fontSize: '14px',
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
          },
          buttonClose: {
            color: 'var(--text-muted, #8e8e93)',
            fontSize: '20px',
            top: '12px',
            right: '12px',
          },
          spotlight: {
            borderRadius: '8px',
          },
        }}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          open: 'Open the dialog',
          skip: 'Skip tour',
        }}
      />
    </>
  );
}

// Export utility functions
export const startOnboardingTour = () => {
  if (tourStateRef) {
    tourStateRef.setStepIndex(0);
    tourStateRef.setRun(true);
  }
};

export const resetOnboardingTour = () => {
  localStorage.removeItem(STORAGE_KEY);
  if (tourStateRef) {
    tourStateRef.setStepIndex(0);
    tourStateRef.setRun(true);
  }
};

export const hasCompletedOnboarding = (): boolean => {
  return localStorage.getItem(STORAGE_KEY) === 'true';
};

export default OnboardingTour;
