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

// Define tour steps with enhanced UX
const TOUR_STEPS: Step[] = [
  {
    target: '.action-pill.search',
    content: (
      <div className="tour-step-content">
        <div className="tour-step-icon">🔍</div>
        <h3>Instant Spotlight Search</h3>
        <p>
          Press <kbd>Cmd+K</kbd> (Mac) or <kbd>Ctrl+K</kbd> (Windows/Linux) to
          open Spotlight Search. Instantly find files, folders, and tags across
          all your storage sources.
        </p>
        <div className="tour-step-tip">
          <strong>Pro tip:</strong> Use operators like <code>tag:</code>,{' '}
          <code>type:</code>, <code>ext:</code>, and <code>size:</code> to
          filter results instantly.
        </div>
      </div>
    ),
    placement: 'top',
    disableBeacon: true,
    disableOverlayClose: false,
  },
  {
    target: '.header-tab[data-tab="metrics"]',
    content: (
      <div className="tour-step-content">
        <div className="tour-step-icon">📊</div>
        <h3>Real-Time System Metrics</h3>
        <p>
          Click the <strong>Metrics</strong> tab to monitor system performance
          in real-time. Track GPU usage, CPU cores, memory, disk I/O, and
          network stats.
        </p>
        <div className="tour-step-tip">
          <strong>Perfect for:</strong> Keeping an eye on resource consumption
          during heavy workloads like video rendering or large file transfers.
        </div>
      </div>
    ),
    placement: 'bottom',
    disableBeacon: true,
    disableOverlayClose: false,
  },
  {
    target: '.action-pill.shortcuts',
    content: (
      <div className="tour-step-content">
        <div className="tour-step-icon">⌨️</div>
        <h3>Keyboard-First Navigation</h3>
        <p>
          Ursly VFS is designed for keyboard productivity. Press <kbd>?</kbd>{' '}
          anytime to view all available shortcuts.
        </p>
        <div className="tour-step-tip">
          <strong>Try it:</strong> Navigate, search, and manage files without
          touching your mouse. Every action has a shortcut.
        </div>
      </div>
    ),
    placement: 'top',
    disableBeacon: true,
    disableOverlayClose: false,
  },
  {
    target: '.header-tab[data-tab="settings"]',
    content: (
      <div className="tour-step-content">
        <div className="tour-step-icon">⚙️</div>
        <h3>Settings & Customization</h3>
        <p>
          Click the <strong>Settings</strong> tab to customize your experience.
          Change themes (dark/light), choose from 10 accent colors, and manage
          all your preferences in one place.
        </p>
        <div className="tour-step-tip">
          <strong>Pro tip:</strong> You can also start or reset the onboarding
          tour from Settings to learn features anytime.
        </div>
      </div>
    ),
    placement: 'bottom',
    disableBeacon: true,
    disableOverlayClose: false,
  },
  {
    target: '.favorites-section',
    content: (
      <div className="tour-step-content">
        <div className="tour-step-icon">⭐</div>
        <h3>Quick Access Favorites</h3>
        <p>
          Drag any file or folder here to add it to favorites for instant
          access. Your favorites are saved locally and sync across sessions.
        </p>
        <div className="tour-step-tip">
          <strong>Alternative:</strong> Right-click any item and select{' '}
          <strong>"Add to Favorites"</strong> from the context menu.
        </div>
      </div>
    ),
    placement: 'right',
    disableBeacon: true,
    disableOverlayClose: false,
  },
  {
    target: '.finder-content, .file-browser',
    content: (
      <div className="tour-step-content">
        <div className="tour-step-icon">📁</div>
        <h3>Unified File Browser</h3>
        <p>
          This is your main workspace. Browse files across all storage sources
          in one unified view. Drag and drop files between storage providers
          seamlessly.
        </p>
        <div className="tour-step-tip">
          <strong>Power features:</strong> Right-click for context menu, use{' '}
          <kbd>Cmd+I</kbd> (Mac) or <kbd>Ctrl+I</kbd> (Windows/Linux) for file
          details, and drag files to move them between storage sources.
        </div>
      </div>
    ),
    placement: 'right',
    disableBeacon: true,
    disableOverlayClose: false,
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
      let retryCount = 0;
      const maxRetries = 20; // Try for up to 10 seconds (20 * 500ms)

      // Wait for DOM to be fully ready and ensure all elements are rendered
      const checkElements = () => {
        const searchButton = document.querySelector('.action-pill.search');
        const shortcutsButton = document.querySelector(
          '.action-pill.shortcuts',
        );
        const fileBrowser =
          document.querySelector('.file-browser') ||
          document.querySelector('.finder-content');
        const metricsTab =
          document.querySelector('.header-tab[data-tab="metrics"]') ||
          document.querySelector('.header-tab:nth-child(2)');
        const settingsTab =
          document.querySelector('.header-tab[data-tab="settings"]') ||
          document.querySelector('.header-tab:nth-child(3)');
        const favoritesSection =
          document.querySelector('.favorites-section') ||
          document.querySelector('.sidebar-section');

        // Check all required elements exist
        if (
          searchButton &&
          shortcutsButton &&
          fileBrowser &&
          metricsTab &&
          settingsTab &&
          favoritesSection
        ) {
          console.log('Onboarding tour: All elements found, starting tour');
          setRun(true);
        } else {
          retryCount++;
          console.log(
            `Onboarding tour: Waiting for elements... (attempt ${retryCount}/${maxRetries})`,
            {
              searchButton: !!searchButton,
              shortcutsButton: !!shortcutsButton,
              fileBrowser: !!fileBrowser,
              metricsTab: !!metricsTab,
              settingsTab: !!settingsTab,
              favoritesSection: !!favoritesSection,
            },
          );

          // Retry after a short delay if elements aren't ready
          if (retryCount < maxRetries) {
            setTimeout(checkElements, 500);
          } else {
            console.warn(
              'Onboarding tour: Max retries reached, some elements not found. Starting tour anyway.',
            );
            // Start tour even if some elements are missing - Joyride will handle missing targets
            setRun(true);
          }
        }
      };

      // Initial delay to ensure app is loaded
      setTimeout(checkElements, 1500);
    } else if (autoStart && hasCompleted) {
      console.log('Onboarding tour: Already completed, skipping');
    }
  }, [autoStart]);

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { status, type, index, action } = data;

      // Handle tour completion, skipping, or closing (Escape/X button)
      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        // Smooth fade out
        requestAnimationFrame(() => {
          setRun(false);
          localStorage.setItem(STORAGE_KEY, 'true');

          if (status === STATUS.FINISHED) {
            onComplete?.();
          } else {
            // Handle skip or close (Escape/X button triggers SKIPPED status)
            onSkip?.();
          }
        });
      } else if (type === 'step:after') {
        // Handle button clicks - advance to next step when Next is clicked
        if (action === 'next' || action === 'prev') {
          requestAnimationFrame(() => {
            if (action === 'next' && index < TOUR_STEPS.length - 1) {
              setStepIndex(index + 1);
            } else if (action === 'prev' && index > 0) {
              setStepIndex(index - 1);
            } else {
              // Last step or first step - keep current index
              setStepIndex(index);
            }
          });
        } else {
          // Other step:after events (e.g., auto-advance) - use the provided index
          requestAnimationFrame(() => {
            setStepIndex(index);
          });
        }
        // Last step - add completion animation
        if (index === TOUR_STEPS.length - 1) {
          const tooltip = document.querySelector('.react-joyride__tooltip');
          if (tooltip) {
            tooltip.classList.add('tour-completing');
          }
        }
      } else if (type === 'error:target_not_found') {
        // If target not found, try to wait a bit and retry, or skip to next step
        console.warn(`Onboarding tour: Target not found for step ${index}`);
        // Wait a bit for DOM to update, then try next step
        setTimeout(() => {
          if (index < TOUR_STEPS.length - 1) {
            setStepIndex(index + 1);
          } else {
            // Last step failed, finish tour
            setRun(false);
            localStorage.setItem(STORAGE_KEY, 'true');
            onComplete?.();
          }
        }, 500);
      } else if (type === 'step:before') {
        // Before showing a step, ensure we're on the right tab with smooth transition
        const step = TOUR_STEPS[index];
        requestAnimationFrame(() => {
          if (step?.target === '.header-tab[data-tab="metrics"]') {
            // Switch to Metrics tab if needed
            const metricsTab = document.querySelector(
              '.header-tab[data-tab="metrics"]',
            ) as HTMLElement;
            if (metricsTab && !metricsTab.classList.contains('active')) {
              metricsTab.style.transition =
                'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
              metricsTab.click();
            }
          } else if (step?.target === '.header-tab[data-tab="settings"]') {
            // Switch to Settings tab if needed
            const settingsTab = document.querySelector(
              '.header-tab[data-tab="settings"]',
            ) as HTMLElement;
            if (settingsTab && !settingsTab.classList.contains('active')) {
              settingsTab.style.transition =
                'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
              settingsTab.click();
            }
          } else if (
            step?.target === '.file-browser' ||
            step?.target === '.favorites-section'
          ) {
            // Ensure we're on Files tab for file browser steps
            const filesTab = document.querySelector(
              '.header-tab:not([data-tab="metrics"]):not([data-tab="settings"])',
            ) as HTMLElement;
            if (filesTab && !filesTab.classList.contains('active')) {
              filesTab.style.transition =
                'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
              filesTab.click();
            }
          }
        });
        // For steps (shortcuts) and (search), we can be on any tab - no switching needed
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
        continuous={true}
        showProgress
        showSkipButton
        disableCloseOnEsc={false}
        hideCloseButton={false}
        disableOverlayClose={false}
        disableScrolling={false}
        scrollOffset={20}
        scrollToFirstStep={true}
        callback={handleJoyrideCallback}
        styles={{
          buttonNext: {
            pointerEvents: 'auto',
            cursor: 'pointer',
            zIndex: 10005,
          },
        }}
        floaterProps={{
          disableAnimation: false,
          styles: {
            arrow: {
              color: 'var(--surface, #1e1e1e)',
            },
          },
          placement: 'auto',
          offset: 10,
        }}
        spotlightClicks={true}
        spotlightPadding={12}
        disableScrollParentFix={false}
        disableScrolling={false}
        scrollOffset={100}
        scrollDuration={400}
        styles={{
          options: {
            primaryColor: 'var(--primary, #0a84ff)',
            textColor: 'var(--text-primary, #f5f5f7)',
            backgroundColor: 'var(--surface, #1e1e1e)',
            overlayColor: 'rgba(0, 0, 0, 0.75)',
            arrowColor: 'var(--surface, #1e1e1e)',
            zIndex: 10002,
            beaconSize: 36,
            spotlightPadding: 8,
            spotlightRadius: 12,
          },
          tooltip: {
            borderRadius: '16px',
            padding: '24px',
            fontFamily:
              'var(--font-sans, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif)',
            maxWidth: '380px',
            boxShadow:
              '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08) inset',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
            background:
              'linear-gradient(135deg, var(--surface, #1e1e1e) 0%, var(--surface-elevated, #252525) 100%)',
          },
          tooltipContainer: {
            textAlign: 'left',
            pointerEvents: 'auto',
            zIndex: 10003,
          },
          tooltipFooter: {
            pointerEvents: 'auto',
            zIndex: 10004,
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          },
          tooltipTitle: {
            fontSize: '20px',
            fontWeight: '700',
            marginBottom: '12px',
            color: 'var(--text-primary, #f5f5f7)',
            lineHeight: '1.3',
          },
          tooltipContent: {
            fontSize: '15px',
            lineHeight: '1.6',
            color: 'var(--text-secondary, #a1a1a6)',
            padding: '0',
          },
          buttonNext: {
            backgroundColor: 'var(--primary, #0a84ff)',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            padding: '10px 24px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(10, 132, 255, 0.3)',
          },
          buttonBack: {
            color: 'var(--text-secondary, #a1a1a6)',
            fontSize: '14px',
            marginRight: '8px',
            padding: '10px 20px',
            borderRadius: '10px',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          },
          buttonSkip: {
            color: 'var(--text-muted, #8e8e93)',
            fontSize: '14px',
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          },
          buttonClose: {
            color: 'var(--text-muted, #8e8e93)',
            fontSize: '22px',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            transition: 'all 0.2s ease',
          },
          spotlight: {
            borderRadius: '12px',
            boxShadow:
              '0 0 0 4px rgba(10, 132, 255, 0.25), 0 0 0 8px rgba(10, 132, 255, 0.15), 0 0 0 12px rgba(10, 132, 255, 0.08)',
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          },
          beacon: {
            animation: 'pulse 2s infinite',
          },
        }}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Get Started',
          next: 'Next',
          open: 'Open the dialog',
          skip: 'Skip tour',
        }}
        disableOverlayClose={false}
        hideBackButton={false}
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
