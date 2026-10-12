import { describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

describe('hallu_editor_dev.bat launcher', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const batPath = path.join(rootDir, 'hallu_editor_dev.bat');

  it('exists at the project root', () => {
    expect(fs.existsSync(batPath)).toBe(true);
  });

  it('fails with an actionable error message when launched without the Vite server', () => {
    if (process.platform !== 'win32') {
      return;
    }

    const result = spawnSync('cmd.exe', ['/c', 'hallu_editor_dev.bat'], {
      cwd: rootDir,
      env: {
        ...process.env,
        HALLU_NO_PAUSE: '1',
      },
      encoding: 'utf-8',
    });

    expect(result.status).not.toBe(0);

    const output = (result.stdout || '') + (result.stderr || '');
    expect(output).toContain('Vite development server is not running');
    expect(output).toContain('launch_vite_server.bat');
  });
});
