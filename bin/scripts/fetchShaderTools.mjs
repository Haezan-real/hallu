// scripts/fetchShaderTools.mjs
// Downloads the pinned shader compilers into bin/tools/shader/ (git-ignored).
//   glslang: GLSL 4.60 -> SPIR-V
//   tint:    SPIR-V -> WGSL, from the Dawn build Chromium 148 (Electron 42) branched from
// Run with: npm run tools:shaders
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'shader');

// sha256 pins the exact archive; an empty value prints the hash on first download instead of checking
const TOOLS = [
  {
    name: 'glslang',
    version: '16.6.0',
    url: 'https://github.com/KhronosGroup/glslang/releases/download/16.6.0/glslang-16.6.0-windows-x86_64-release.zip',
    sha256: '82bf434e69b9bb4829de7e2b4bc2c5e7a7861e53d66cf75e5cc70f5f694a8d9b',
    executable: 'glslang.exe',
  },
  {
    name: 'tint',
    version: 'dawn v20260403.135149 (4ac004b63a, Chromium 148 branch point)',
    url: 'https://github.com/google/dawn/releases/download/v20260403.135149/Dawn-4ac004b63afcc923288bc2c1477376b28212c652-windows-latest-Release.tar.gz',
    sha256: 'a49aad8cdc5944039c2effc8a384d731d1873ae67669d6ce703f4d7e0392a0a6',
    executable: 'tint.exe',
  },
];

function findFile(dir, fileName) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const found = findFile(full, fileName);
      if (found) return found;
    } else if (entry.toLowerCase() === fileName) {
      return full;
    }
  }
  return null;
}

async function fetchTool(tool, workDir) {
  console.log(`Downloading ${tool.name} ${tool.version}...`);
  const response = await fetch(tool.url);
  if (!response.ok) throw new Error(`${tool.name}: HTTP ${response.status} for ${tool.url}`);
  const archive = Buffer.from(await response.arrayBuffer());

  const hash = createHash('sha256').update(archive).digest('hex');
  if (!tool.sha256) {
    console.warn(`  ${tool.name} has no pinned sha256 yet. Downloaded archive hash: ${hash}`);
  } else if (hash !== tool.sha256) {
    throw new Error(`${tool.name}: sha256 mismatch (expected ${tool.sha256}, got ${hash})`);
  }

  const archivePath = join(workDir, tool.url.split('/').pop());
  writeFileSync(archivePath, archive);
  const extractDir = join(workDir, tool.name);
  mkdirSync(extractDir);
  // Windows' bundled bsdtar handles both .zip and .tar.gz (Git's GNU tar, if first on PATH, can't)
  execFileSync(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', archivePath, '-C', extractDir]);

  const executable = findFile(extractDir, tool.executable);
  if (!executable) throw new Error(`${tool.name}: ${tool.executable} not found in the archive`);
  copyFileSync(executable, join(TOOLS_DIR, tool.executable));
  console.log(`  -> tools/shader/${tool.executable}`);
  return { version: tool.version, sha256: hash };
}

async function main() {
  if (process.platform !== 'win32') throw new Error('Only Windows builds are pinned so far');
  mkdirSync(TOOLS_DIR, { recursive: true });
  const workDir = mkdtempSync(join(tmpdir(), 'hallu-shader-tools-'));
  try {
    const versions = {};
    for (const tool of TOOLS) versions[tool.name] = await fetchTool(tool, workDir);
    writeFileSync(join(TOOLS_DIR, 'versions.json'), JSON.stringify(versions, null, 2));
  } finally {
    if (existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
