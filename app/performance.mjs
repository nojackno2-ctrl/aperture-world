/** The live view is allowed to follow high-refresh displays up to 120 Hz. */
export const TARGET_RENDER_FPS = 120;
export const MIN_PIXEL_RATIO = 0.75;
export const MAX_PIXEL_RATIO = 1.5;
export const MAX_LIVE_PIXELS = 2560 * 1440;

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
