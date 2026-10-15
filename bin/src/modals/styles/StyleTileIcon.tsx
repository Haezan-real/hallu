//src/modals/styles/StyleTileIcon.tsx
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { ShaderCompileError } from '../../shared/platform/electronApi';
import { readThemeColors } from '../../features/shaders/themeColorFade';
import type { StyleItem } from './styleLibrary';
import { getThemeColors } from './themeColors';
import type { ThemeColors } from './colorFields';
import StylePreview from './StylePreview';
import { getShaderIconRenderer, type ShaderIconHandle } from './shaderIconRenderer';

type IconCallbacks = MutableRefObject<{ onReady: () => void; onError: () => void }>;
interface IconProps {
  file: string;
  version: number;
  callbacks: IconCallbacks;
}

const IMAGE_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const fillStyle = { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' } as const;
const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

function reportIconErrors(file: string, errors: ShaderCompileError[]) {
  for (const error of errors) {
    console.warn(`Style icon styles/${file}${error.line ? ` line ${error.line}` : ''}: ${error.message}`);
  }
}

// One object URL per image file, replaced (and the old one freed) when the file changes
const imageUrls = new Map<string, { version: number; url: Promise<string> }>();

function loadImageUrl(file: string, version: number): Promise<string> {
  const cached = imageUrls.get(file);
  if (cached?.version === version) return cached.url;
  if (cached) void cached.url.then(URL.revokeObjectURL, () => {});

  const extension = file.split('.').pop()?.toLowerCase() ?? '';
  const url = window.electronAPI!.readStyleIconImage(file)
    .then(bytes => URL.createObjectURL(new Blob([bytes as BlobPart], { type: IMAGE_TYPES[extension] })));
  const entry = { version, url };
  imageUrls.set(file, entry);
  url.catch(() => { if (imageUrls.get(file) === entry) imageUrls.delete(file); });
  return url;
}

function ImageIcon({ file, version, callbacks }: IconProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadImageUrl(file, version).then(
      loaded => { if (!cancelled) setUrl(loaded); },
      err => {
        if (cancelled) return;
        reportIconErrors(file, [{ line: null, message: errorMessage(err) }]);
        callbacks.current.onError();
      },
    );
    return () => { cancelled = true; };
  }, [file, version, callbacks]);

  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      style={{ ...fillStyle, objectFit: 'cover' }}
      onLoad={() => callbacks.current.onReady()}
      onError={() => {
        reportIconErrors(file, [{ line: null, message: 'not a readable image' }]);
        callbacks.current.onError();
      }}
    />
  );
}

function ShaderIcon({ file, version, callbacks, themeColors }: IconProps & { themeColors: Float32Array }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<ShaderIconHandle | null>(null);
  const themeColorsRef = useRef(themeColors);
  themeColorsRef.current = themeColors;

  useEffect(() => {
    const canvas = canvasRef.current;
    const api = window.electronAPI;
    if (!canvas || !api) return;
    const abort = new AbortController();
    let observer: IntersectionObserver | null = null;
    const fail = (errors: ShaderCompileError[]) => {
      reportIconErrors(file, errors);
      callbacks.current.onError();
    };

    void (async () => {
      const renderer = await getShaderIconRenderer();
      if (abort.signal.aborted) return;
      if (!renderer) return fail([{ line: null, message: 'WebGPU is unavailable' }]);
      const compiled = await api.compileStyleIconShader(file);
      if (abort.signal.aborted) return;
      if (!compiled.ok) return fail(compiled.errors);
      const created = await renderer.createIcon(canvas, compiled.wgsl, themeColorsRef.current, abort.signal);
      if (!created || abort.signal.aborted) {
        if (created && !Array.isArray(created)) created.destroy();
        return;
      }
      if (Array.isArray(created)) return fail(created);
      handleRef.current = created;
      created.renderAt(0);
      observer = new IntersectionObserver(([entry]) => created.setVisible(entry.isIntersecting));
      observer.observe(canvas);
      callbacks.current.onReady();
    })();

    return () => {
      abort.abort();
      observer?.disconnect();
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, [file, version, callbacks]);

  useEffect(() => {
    handleRef.current?.setThemeColors(themeColors);
  }, [themeColors]);

  return <canvas ref={canvasRef} style={fillStyle} />;
}

/**
 * A style's tile picture: its .frag or image icon when it has one, otherwise the
 * generated preview, which also shows while the icon loads and if it fails.
 */
export default function StyleTileIcon({ style }: { style: StyleItem }) {
  const { icon } = style;
  const iconKey = icon ? `${icon.file}|${icon.version}` : null;
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const callbacks: IconCallbacks = useRef({ onReady: () => {}, onError: () => {} });
  callbacks.current = { onReady: () => setReadyKey(iconKey), onError: () => setFailedKey(iconKey) };

  const colors = getThemeColors(style.id);
  const colorsKey = JSON.stringify(colors);
  const themeColors = useMemo(() => {
    const parsed = JSON.parse(colorsKey) as ThemeColors;
    return readThemeColors({ getPropertyValue: name => parsed[name as keyof ThemeColors] || '#000000' });
  }, [colorsKey]);

  const showIcon = icon !== null && failedKey !== iconKey;
  const showPreview = !showIcon || readyKey !== iconKey;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {showPreview && <StylePreview colors={colors} />}
      {showIcon && icon.kind === 'image' && <ImageIcon key={iconKey} file={icon.file} version={icon.version} callbacks={callbacks} />}
      {showIcon && icon.kind === 'shader' && <ShaderIcon key={iconKey} file={icon.file} version={icon.version} callbacks={callbacks} themeColors={themeColors} />}
    </div>
  );
}
