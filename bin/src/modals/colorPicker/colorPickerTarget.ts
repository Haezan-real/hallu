//src/modals/colorPicker/colorPickerTarget.ts
// The one thing the Color Picker panel edits: whatever opened it most recently

export interface ColorPickerTarget {
  /** The color to start from, hex like #rrggbb */
  value: string;
  onChange: (hex: string) => void;
  /** Shown above the wheel, e.g. which theme color this is */
  label?: string;
  /** The picker stopped reporting here: it closed, or something else opened it */
  onClose?: () => void;
}

/** `id` changes with every new target, so the picker can start over from its value */
export interface ColorPickerBinding {
  target: ColorPickerTarget;
  id: number;
}

let binding: ColorPickerBinding | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

export function getColorPickerBinding(): ColorPickerBinding | null {
  return binding;
}

/** Points the picker at `target`; the previous target is told it lost the picker */
export function setColorPickerTarget(target: ColorPickerTarget) {
  const previous = binding?.target;
  binding = { target, id: nextId++ };
  if (previous && previous !== target) previous.onClose?.();
  emit();
}

/** The picker closed: its target is told, and nothing is targeted until it opens again */
export function releaseColorPickerTarget() {
  const previous = binding?.target;
  if (!previous) return;
  binding = null;
  previous.onClose?.();
  emit();
}

/** Reports a picked color to the current target */
export function pickColor(hex: string) {
  binding?.target.onChange(hex);
}

export function subscribeColorPickerTarget(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
