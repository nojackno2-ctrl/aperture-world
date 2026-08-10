/** The live view is allowed to follow high-refresh displays up to 120 Hz. */
export const TARGET_RENDER_FPS = 120;
export const MIN_PIXEL_RATIO = 0.75;
export const MAX_PIXEL_RATIO = 1.5;
export const MAX_LIVE_PIXELS = 2560 * 1440;
export const MIN_PHOTO_SHORT_EDGE = 1080;
export const MIN_PHOTO_LONG_EDGE = 1920;
export const CAPTURE_SAMPLE_SPACING_PX = 2.5;
export const MAX_CAPTURE_SAMPLES = 64;

/**
 * Preserve the composed viewfinder aspect ratio while guaranteeing a true
 * Full-HD-or-better photo in either orientation. Wider and taller displays
 * keep the short edge at 1080 instead of cropping the user's composition.
 */
export function photoOutputSize(width, height) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const aspect = safeWidth / safeHeight;

  if (aspect >= 1) {
    const outputWidth = Math.max(MIN_PHOTO_LONG_EDGE, Math.ceil(MIN_PHOTO_SHORT_EDGE * aspect));
    return { width: outputWidth, height: Math.max(MIN_PHOTO_SHORT_EDGE, Math.round(outputWidth / aspect)) };
  }

  const outputHeight = Math.max(MIN_PHOTO_LONG_EDGE, Math.ceil(MIN_PHOTO_SHORT_EDGE / aspect));
  return { width: Math.max(MIN_PHOTO_SHORT_EDGE, Math.round(outputHeight * aspect)), height: outputHeight };
}

/**
 * Resolve enough temporal samples to keep visible exposure steps within a few
 * pixels. A truly static/sub-pixel frame needs one render, while motion blur,
 * camera shake, and panning scale smoothly up to the established quality cap.
 */
export function captureSampleCount(motionPixels) {
  const travel = Math.max(0, Number(motionPixels) || 0);
  if (travel <= 0.5) return 1;
  return Math.max(2, Math.min(MAX_CAPTURE_SAMPLES, Math.ceil(travel / CAPTURE_SAMPLE_SPACING_PX)));
}

/**
 * Background scene downloads are optional polish, not part of the current
 * shot. Respect the browser's reduced-data signal and avoid competing with the
 * active world on connections the Network Information API identifies as slow.
 */
export function shouldPrefetchScenes(connection) {
  if (!connection) return true;
  return !connection.saveData && connection.effectiveType !== "slow-2g" && connection.effectiveType !== "2g";
}

/** Keep 4K/high-DPI screens inside a predictable GPU fill-rate budget. */
export function cappedPixelRatio(devicePixelRatio, width, height) {
  const nativeRatio = Math.max(MIN_PIXEL_RATIO, Math.min(MAX_PIXEL_RATIO, devicePixelRatio || 1));
  const pixelBudgetRatio = Math.sqrt(MAX_LIVE_PIXELS / Math.max(1, width * height));
  return Math.max(MIN_PIXEL_RATIO, Math.min(nativeRatio, pixelBudgetRatio));
}

/**
 * Infer the refresh rate from the fastest stable animation-frame interval.
 * A 60 Hz panel should not sacrifice resolution chasing frames it cannot show,
 * while 120/144 Hz panels retain a 120 FPS rendering target.
 */
export function refreshTargetFps(fastestFrameMs) {
  if (!(fastestFrameMs > 0)) return 60;
  const measured = 1000 / fastestFrameMs;
  const commonRates = [30, 60, 75, 90, 100, 120, 144, 165, 240];
  const closest = commonRates.reduce((best, rate) => Math.abs(rate - measured) < Math.abs(best - measured) ? rate : best);
  return Math.min(TARGET_RENDER_FPS, closest);
}

/** One small quality step per sampling window prevents resolution oscillation. */
export function nextPixelRatio(current, maximum, fps, targetFps, stableWindows = 0) {
  if (fps < targetFps * 0.88 && current > MIN_PIXEL_RATIO) return Math.max(MIN_PIXEL_RATIO, current - 0.125);
  if (stableWindows >= 4 && fps >= targetFps * 0.97 && current < maximum) return Math.min(maximum, current + 0.125);
  return current;
}
