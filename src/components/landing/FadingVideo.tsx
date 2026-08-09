import { useEffect, useRef } from "react";

type FadingVideoProps = {
  src: string;
  className?: string;
  /** Fade duration in seconds applied at the start and end of every loop. */
  fade?: number;
  poster?: string;
};

/**
 * Looping background video that starts fully transparent and crossfades itself
 * on every loop using requestAnimationFrame (no CSS transitions involved).
 */
export function FadingVideo({ src, className, fade = 1.2, poster }: FadingVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let frame = 0;

    const tick = () => {
      const duration = video.duration;
      if (Number.isFinite(duration) && duration > 0) {
        const t = video.currentTime;
        const fadeIn = Math.min(t / fade, 1);
        const fadeOut = Math.min(Math.max((duration - t) / fade, 0), 1);
        const opacity = Math.max(0, Math.min(fadeIn, fadeOut));
        video.style.opacity = opacity.toFixed(4);
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    const play = () => void video.play().catch(() => undefined);
    play();

    return () => cancelAnimationFrame(frame);
  }, [fade, src]);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      style={{ opacity: 0 }}
      className={className}
    />
  );
}
