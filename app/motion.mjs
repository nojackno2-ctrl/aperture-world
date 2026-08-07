/**
 * @typedef {"landscape" | "bird" | "sports" | "portrait" | "group" | "street" | "night"} SceneKey
 * @typedef {{ x: number, y: number, rotate: number, scale: number }} MotionPose
 */

/**
 * Returns a deterministic subject pose for an elapsed time. Moving scenes use
 * different paths so flight, sprinting, daytime walking, and rain walking do
 * not collapse into the same horizontal oscillation.
 *
 * @param {SceneKey} scene
 * @param {number} seconds
 * @returns {MotionPose}
 */
export function motionPose(scene, seconds) {
  if (scene === "bird") {
    const t = (seconds % 7.2) / 7.2;
    return { x: -34 + t * 68, y: -9 * Math.sin(Math.PI * t) + 2 * Math.sin(Math.PI * t * 3), rotate: -8 * Math.cos(Math.PI * t), scale: .9 + .16 * Math.sin(Math.PI * t) };
  }
  if (scene === "sports") {
    const t = (seconds % 5.4) / 5.4;
    return { x: -35 + t * 70, y: 4 - t * 8 + Math.sin(t * Math.PI * 16) * .65, rotate: -2.5 + Math.sin(t * Math.PI * 16) * 1.2, scale: .92 + t * .14 };
  }
  if (scene === "street") {
    const t = (seconds % 8.8) / 8.8;
    return { x: -30 + t * 60, y: -4 + t * 8 + Math.sin(t * Math.PI * 12) * .45, rotate: Math.sin(t * Math.PI * 12) * 1.2, scale: .9 + t * .14 };
  }
  if (scene === "night") {
    const t = (seconds % 10.5) / 10.5;
    return { x: 29 - t * 58, y: 4 - t * 7 + Math.sin(t * Math.PI * 14) * .55, rotate: -Math.sin(t * Math.PI * 14), scale: 1.05 - t * .13 };
  }
  return { x: 0, y: 0, rotate: 0, scale: 1 };
}
