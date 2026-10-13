//src/modals/torusEditor/delayScale.ts
import type { SliderScale } from '../../shared/ui/controls/Slider';

// Slider 0..1000 → delay -1000..1000ms; 500 is 0ms and both halves are log scale in magnitude
function sliderToDelay(slider: number): number {
  if (slider === 500) return 0;
  if (slider < 500) {
    const t = (500 - slider) / 500;
    return -Math.round(Math.pow(10, t * 3));
  }
  const t = (slider - 500) / 500;
  return Math.round(Math.pow(10, t * 3));
}

function delayToSlider(delay: number): number {
  if (delay === 0) return 500;
  const t = Math.log10(Math.max(1, Math.abs(delay))) / 3;
  return Math.round(delay < 0 ? 500 - t * 500 : 500 + t * 500);
}

export const DELAY_SCALE: SliderScale = {
  toPosition: delayToSlider,
  fromPosition: sliderToDelay,
};
