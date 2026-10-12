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

  it('fails with an actionable error message when launched without the Vite server', async () => {
    if (process.platform !== 'win32') {
      return;
    }

    const net = await import('net');
    const isServerRunning = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection(5173, '127.0.0.1', () => {
        socket.end();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
      socket.setTimeout(500, () => {
        socket.destroy();
        resolve(false);
      });
    });

    if (isServerRunning) {
      // If a dev server is currently running, skip testing the "server offline" branch
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
    expect(output).toContain('launch_vite_server.bat');
  });
});

describe('launch_vite_server.bat launcher', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const batPath = path.join(rootDir, 'launch_vite_server.bat');

  it('exists at the project root', () => {
    expect(fs.existsSync(batPath)).toBe(true);
  });

  it('warns about duplicate server and prompts to cancel when port 5173 is already in use', async () => {
    if (process.platform !== 'win32') {
      return;
    }

    const net = await import('net');
    const mockServer = net.createServer();
    await new Promise<void>((resolve, reject) => {
      mockServer.once('error', reject);
      mockServer.listen(5173, '127.0.0.1', () => resolve());
    });

    try {
      const result = spawnSync('cmd.exe', ['/c', 'launch_vite_server.bat'], {
        cwd: rootDir,
        input: 'N\n',
        encoding: 'utf-8',
      });

      const output = (result.stdout || '') + (result.stderr || '');
      expect(output).toContain('Port 5173 is already in use');
      expect(output).toContain('duplicate server');
      expect(output).toContain('[Y/N]');
      expect(output).toContain('Launch cancelled');
    } finally {
      await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    }
  });
});
