//src/features/shaders/shaderMirrors.ts

const mirrors = new Set<HTMLCanvasElement>();

/**
 * A canvas that shows the shader background for the area it covers, copied there every frame.
 * Windows that float over other panels put one behind their content, so the background (and
 * whatever the pack draws for them) shows through instead of the panels underneath.
 */
export function registerShaderMirror(canvas: HTMLCanvasElement): () => void {
  mirrors.add(canvas);
  return () => {
    mirrors.delete(canvas);
  };
}

export function shaderMirrors(): ReadonlySet<HTMLCanvasElement> {
  return mirrors;
}
