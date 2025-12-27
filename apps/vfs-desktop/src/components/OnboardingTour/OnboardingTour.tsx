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
    target: '.metrics-header .settings-btn',
    content: (
      <div className="tour-step-content">
        <h3>Alert Thresholds</h3>
        <p>
          Configure alert thresholds for CPU, memory, GPU, and temperature. Get
          notified when metrics exceed your custom limits to stay on top of
          system performance.
        </p>
        <div className="tour-step-tip">
          <strong>Pro tip:</strong> Set thresholds based on your workload. Lower
          thresholds for critical tasks, higher for general use.
        </div>
      </div>
    ),
    placement: 'bottom',
    disableBeacon: true,
    disableOverlayClose: false,
    disableScrolling: false,
  },
  {
    target: '.action-pill.shortcuts',
    content: (
      <div className="tour-step-content">
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
        const alertThresholdsBtn = document.querySelector(
          '.metrics-header .settings-btn',
        );

        // Check all required elements exist
        if (
          searchButton &&
          shortcutsButton &&
          fileBrowser &&
          metricsTab &&
          settingsTab &&
          alertThresholdsBtn
        ) {
          setRun(true);
        } else {
          retryCount++;
          if (retryCount < maxRetries) {
            setTimeout(checkElements, 500);
          } else {
            setRun(true);
          }
        }
      };

      setTimeout(checkElements, 1500);
    }
  }, [autoStart]);

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { status, type, index, action } = data;

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        requestAnimationFrame(() => {
          setRun(false);
          localStorage.setItem(STORAGE_KEY, 'true');

          if (status === STATUS.FINISHED) {
            onComplete?.();
          } else {
            onSkip?.();
          }
        });
        return;
      }

      if (type === 'step:after') {
        if (action === 'next') {
          if (index < TOUR_STEPS.length - 1) {
            requestAnimationFrame(() => {
              setStepIndex(index + 1);
            });
          } else {
            requestAnimationFrame(() => {
              setRun(false);
              localStorage.setItem(STORAGE_KEY, 'true');
              onComplete?.();
            });
          }
        } else if (action === 'prev') {
          if (index > 0) {
            requestAnimationFrame(() => {
              setStepIndex(index - 1);
            });
          }
        } else {
          requestAnimationFrame(() => {
            setStepIndex(index);
          });
        }

        if (index === TOUR_STEPS.length - 1 && action === 'next') {
          const tooltip = document.querySelector('.react-joyride__tooltip');
          if (tooltip) {
            tooltip.classList.add('tour-completing');
          }
        }
      } else if (type === 'error:target_not_found') {
        // For Alert Thresholds step, wait longer and retry
        if (step?.target === '.metrics-header .settings-btn') {
          setTimeout(() => {
            const settingsBtn = document.querySelector(
              '.metrics-header .settings-btn',
            );
            if (settingsBtn) {
              // Element found, retry current step
              setStepIndex(index);
            } else {
              // Still not found, skip to next step
              if (index < TOUR_STEPS.length - 1) {
                setStepIndex(index + 1);
              } else {
                setRun(false);
                localStorage.setItem(STORAGE_KEY, 'true');
                onComplete?.();
              }
            }
          }, 1000);
        } else {
          // For other steps, skip normally
          setTimeout(() => {
            if (index < TOUR_STEPS.length - 1) {
              setStepIndex(index + 1);
            } else {
              setRun(false);
              localStorage.setItem(STORAGE_KEY, 'true');
              onComplete?.();
            }
          }, 500);
        }
      } else if (type === 'step:before') {
        const step = TOUR_STEPS[index];
        requestAnimationFrame(() => {
          if (step?.target === '.header-tab[data-tab="metrics"]') {
            const metricsTab = document.querySelector(
              '.header-tab[data-tab="metrics"]',
            ) as HTMLElement;
            if (metricsTab && !metricsTab.classList.contains('active')) {
              metricsTab.style.transition =
                'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
              metricsTab.click();
            }
          } else if (step?.target === '.metrics-header .settings-btn') {
            // Ensure we're on the metrics tab first (should already be from previous step)
            const metricsTab = document.querySelector(
              '.header-tab[data-tab="metrics"]',
            ) as HTMLElement;
            if (metricsTab && !metricsTab.classList.contains('active')) {
              metricsTab.style.transition =
                'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
              metricsTab.click();
            }
            // Wait for metrics page to fully render (including data loading)
            setTimeout(() => {
              const metricsPage = document.querySelector('.metrics-page');
              const loadingState = document.querySelector('.metrics-loading');
              const errorState = document.querySelector('.metrics-error');

              // Only proceed if page is rendered and not in loading/error state
              if (metricsPage && !loadingState && !errorState) {
                // Wait a bit more for settings button to be available
                setTimeout(() => {
                  const settingsBtn = document.querySelector(
                    '.metrics-header .settings-btn',
                  ) as HTMLElement;
                  if (settingsBtn) {
                    settingsBtn.scrollIntoView({
                      block: 'nearest',
                      behavior: 'smooth',
                    });
                  }
                }, 200);
              }
            }, 800);
          } else if (step?.target === '.header-tab[data-tab="settings"]') {
            const settingsTab = document.querySelector(
              '.header-tab[data-tab="settings"]',
            ) as HTMLElement;
            if (settingsTab && !settingsTab.classList.contains('active')) {
              settingsTab.style.transition =
                'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
              settingsTab.click();
            }
          }
        });
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
        hideCloseButton={true}
        disableScrolling={false}
        scrollOffset={100}
        scrollToFirstStep={true}
        scrollDuration={400}
        callback={handleJoyrideCallback}
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
        disableScrollParentFix={false}
        styles={{
          options: {
            primaryColor: 'var(--primary, #0a84ff)',
            textColor: 'var(--text-primary, #f5f5f7)',
            backgroundColor: 'var(--surface, #1e1e1e)',
            overlayColor: 'rgba(0, 0, 0, 0.08)',
            arrowColor: 'var(--surface, #1e1e1e)',
            zIndex: 10002,
            beaconSize: 36,
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
              '0 0 0 4px rgba(10, 132, 255, 0.4), 0 0 0 8px rgba(10, 132, 255, 0.25), 0 0 0 12px rgba(10, 132, 255, 0.15), 0 0 0 16px rgba(10, 132, 255, 0.08)',
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            backgroundColor: 'transparent',
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
