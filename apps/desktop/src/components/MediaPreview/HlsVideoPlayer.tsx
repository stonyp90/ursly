/**
 * HLS Video Player Component
 *
 * Uses hls.js for HLS playback with fallback to native video for supported browsers.
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import Hls, { Level, ErrorData, ManifestParsedData } from 'hls.js';
import './MediaPreview.css';

export interface HlsVideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  onReady?: () => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
}

export function HlsVideoPlayer({
  src,
  poster,
  autoPlay = false,
  onReady,
  onError,
  onProgress,
}: HlsVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<number>(-1); // -1 = auto
  const [availableQualities, setAvailableQualities] = useState<
    { label: string; value: number }[]
  >([]);

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

      <video
        ref={videoRef}
        poster={poster}
        controls
        playsInline
        className="video-element"
      />

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
