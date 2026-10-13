/**
 * //src/shared/ui/graphEditor/sensitivity.ts
 * Drag sensitivity utility for controlling mouse drag speed
 * Sensitivity is measured in pixels per pixel (ppp)
 */

export const DEFAULT_SENSITIVITY = 1;
export const MIN_SENSITIVITY = 0.01;
export const MAX_SENSITIVITY = 10;
export const DISPLAY_DURATION_MS = 1500;

/**
 * Format sensitivity for display
 * - As fraction (e.g., "1/2 ppp") if < 1
 * - As decimal (e.g., "1.500 ppp") if >= 1
 */
export function formatSensitivity(sensitivity: number): string {
  if (sensitivity < 1) {
    // Find a nice fraction representation
    const denominator = Math.round(1 / sensitivity);
    if (denominator > 0 && Math.abs(sensitivity - 1 / denominator) < 0.02) {
      return `1/${denominator} ppp`;
    }
    return `${sensitivity.toFixed(3)} ppp`;
  }
  return `${sensitivity.toFixed(3)} ppp`;
}

/**
 * Adjust sensitivity based on scroll delta
 * @param currentSensitivity Current sensitivity value
 * @param deltaY Scroll delta (negative = scroll up, positive = scroll down)
 * @returns New sensitivity value clamped to valid range
 */
export function adjustSensitivity(currentSensitivity: number, deltaY: number): number {
  if (currentSensitivity <= 0) return MIN_SENSITIVITY;
  // Scroll up = multiply by 1.5, scroll down = divide by 1.5
  const factor = deltaY < 0 ? 1.5 : 1 / 1.5;
  const newSensitivity = currentSensitivity * factor;
  return Math.max(MIN_SENSITIVITY, Math.min(MAX_SENSITIVITY, newSensitivity));
}
