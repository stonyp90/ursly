/**
 * HLS Video Player Component
 *
 * Uses hls.js for HLS playback with fallback to native video for supported browsers.
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import Hls, { Level, ErrorData, ManifestParsedData } from 'hls.js';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { TranscriptionPanel } from './TranscriptionPanel';
import './MediaPreview.css';

export interface TranscriptionSegment {
  text: string;
  start_time: number;
  end_time: number;
  confidence?: number;
}

export interface HlsVideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  onReady?: () => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
  enableTranscription?: boolean;
  videoPath?: string; // File path for transcription
}

export function HlsVideoPlayer({
  src,
  poster,
  autoPlay = false,
  onReady,
  onError,
  onProgress,
  enableTranscription = false,
  videoPath,
}: HlsVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<number>(-1); // -1 = auto
  const [availableQualities, setAvailableQualities] = useState<
    { label: string; value: number }[]
  >([]);
  const [transcriptionActive, setTranscriptionActive] = useState(false);
  const [transcriptionJobId, setTranscriptionJobId] = useState<string | null>(
    null,
  );
  const [transcriptionSegments, setTranscriptionSegments] = useState<
    TranscriptionSegment[]
  >([]);
  const [currentCaption, setCurrentCaption] = useState<string>('');
  const [showTranscriptionPanel, setShowTranscriptionPanel] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Check if source is HLS
    const isHls = src.endsWith('.m3u8');

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hlsRef.current = hls;

      hls.on(
        Hls.Events.MANIFEST_PARSED,
        (_event: string, data: ManifestParsedData) => {
          setIsLoading(false);
          onReady?.();

          // Get available quality levels
          const levels = data.levels.map((level: Level, index: number) => ({
            label: `${level.height}p`,
            value: index,
          }));
          levels.unshift({ label: 'Auto', value: -1 });
          setAvailableQualities(levels);

          if (autoPlay) {
            video.play().catch(console.error);
          }
        },
      );

      hls.on(Hls.Events.ERROR, (_event: string, data: ErrorData) => {
        if (data.fatal) {
          const errorMsg = `HLS Error: ${data.type} - ${data.details}`;
          setError(errorMsg);
          onError?.(errorMsg);

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Try to recover
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              destroyHls();
              break;
          }
        }
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        const buffered = video.buffered;
        if (buffered.length > 0) {
          const progress =
            (buffered.end(buffered.length - 1) / video.duration) * 100;
          onProgress?.(progress);
        }
      });

      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        onReady?.();
        if (autoPlay) {
          video.play().catch(console.error);
        }
      });
    } else if (!isHls) {
      // Regular video
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        onReady?.();
        if (autoPlay) {
          video.play().catch(console.error);
        }
      });
    } else {
      setError('HLS is not supported in this browser');
      onError?.('HLS is not supported in this browser');
    }

    return () => {
      destroyHls();
    };
  }, [src, autoPlay, onReady, onError, onProgress, destroyHls]);

  // Handle quality change
  useEffect(() => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = quality;
    }
  }, [quality]);

  // Transcription handling
  useEffect(() => {
    if (!enableTranscription || !videoPath) return;

    const startTranscription = async () => {
      try {
        const jobId = await invoke<string>('vfs_start_transcription', {
          filePath: videoPath,
        });
        setTranscriptionJobId(jobId);
        setTranscriptionActive(true);
      } catch (err) {
        console.error('Failed to start transcription:', err);
        setError(`Transcription failed: ${err}`);
      }
    };

    if (enableTranscription && !transcriptionActive) {
      startTranscription();
    }

    return () => {
      if (transcriptionJobId) {
        invoke('vfs_stop_transcription', { jobId: transcriptionJobId }).catch(
          console.error,
        );
      }
    };
  }, [enableTranscription, videoPath, transcriptionActive, transcriptionJobId]);

  // Listen for transcription events
  useEffect(() => {
    if (!transcriptionJobId) return;

    const unlistenSegment = listen<{
      job_id: string;
      segment: TranscriptionSegment;
    }>('transcription:segment', (event) => {
      if (event.payload.job_id === transcriptionJobId) {
        setTranscriptionSegments((prev) => [...prev, event.payload.segment]);
      }
    });

    const unlistenProgress = listen<{
      job_id: string;
      progress: number;
      current_time: number;
    }>('transcription:progress', (event) => {
      if (event.payload.job_id === transcriptionJobId) {
        setTranscriptionProgress(event.payload.progress);
      }
    });

    return () => {
      unlistenSegment.then((fn) => fn());
      unlistenProgress.then((fn) => fn());
    };
  }, [transcriptionJobId]);

  // Handle seek to timestamp
  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = time;
      video.play();
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle transcription panel with 'T'
      if (e.key === 't' || e.key === 'T') {
        if (transcriptionActive && transcriptionSegments.length > 0) {
          setShowTranscriptionPanel((prev) => !prev);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [transcriptionActive, transcriptionSegments.length]);

  // Update current caption based on video time
  useEffect(() => {
    const video = videoRef.current;
    if (!video || transcriptionSegments.length === 0) return;

    const updateCaption = () => {
      const currentTime = video.currentTime;
      const segment = transcriptionSegments.find(
        (seg) => currentTime >= seg.start_time && currentTime <= seg.end_time,
      );
      setCurrentCaption(segment?.text || '');
    };

    video.addEventListener('timeupdate', updateCaption);
    return () => {
      video.removeEventListener('timeupdate', updateCaption);
    };
  }, [transcriptionSegments]);

  if (error) {
    return (
      <div className="video-player-error">
        <span className="error-icon">⚠️</span>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="hls-video-player">
      {isLoading && (
        <div className="video-loading">
          <div className="loading-spinner" />
          <span>Loading video...</span>
        </div>
      )}

      <div className="video-container">
        <video
          ref={videoRef}
          poster={poster}
          controls
          playsInline
          className="video-element"
        />
        {currentCaption && (
          <div className="video-captions">
            <span>{currentCaption}</span>
          </div>
        )}
        {transcriptionActive && (
          <div className="transcription-indicator">
            <span className="transcription-dot" /> Live Transcription
            {transcriptionSegments.length > 0 && (
              <button
                onClick={() =>
                  setShowTranscriptionPanel(!showTranscriptionPanel)
                }
                className="transcription-toggle-panel"
                title="Toggle transcription panel"
              >
                📝
              </button>
            )}
          </div>
        )}
      </div>

      {/* Transcription Panel */}
      {transcriptionActive && (
        <TranscriptionPanel
          segments={transcriptionSegments}
          currentTime={videoRef.current?.currentTime || 0}
          onSeek={handleSeek}
          isActive={showTranscriptionPanel}
          progress={transcriptionProgress}
          onClose={() => setShowTranscriptionPanel(false)}
        />
      )}

      {availableQualities.length > 1 && (
        <div className="quality-selector">
          <select
            value={quality}
            onChange={(e) => setQuality(parseInt(e.target.value))}
            title="Video quality"
          >
            {availableQualities.map((q) => (
              <option key={q.value} value={q.value}>
                {q.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export default HlsVideoPlayer;
