export const FULL_FRAME_SENSOR_WIDTH_MM = 35.9;

export function horizontalFieldOfView(focalLengthMm, sensorWidthMm = FULL_FRAME_SENSOR_WIDTH_MM) {
  if (!(focalLengthMm > 0) || !(sensorWidthMm > 0)) throw new RangeError("Focal length and sensor width must be positive");
  return 2 * Math.atan(sensorWidthMm / (2 * focalLengthMm)) * 180 / Math.PI;
}

/**
 * Vertical angle of view for a rendered frame, which is what a perspective 3D
 * camera needs. The horizontal angle stays anchored to the full-frame sensor
 * width, so the framing matches the lens no matter the window shape.
 *
 * @param {number} focalLengthMm
 * @param {number} aspect rendered width divided by height
 * @param {number} [sensorWidthMm]
 * @returns {number} degrees
 */
export function verticalFieldOfView(focalLengthMm, aspect, sensorWidthMm = FULL_FRAME_SENSOR_WIDTH_MM) {
  if (!(aspect > 0)) throw new RangeError("Aspect ratio must be positive");
  const halfHorizontal = horizontalFieldOfView(focalLengthMm, sensorWidthMm) * Math.PI / 360;
  return 2 * Math.atan(Math.tan(halfHorizontal) / aspect) * 180 / Math.PI;
}
