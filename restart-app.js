#!/usr/bin/env node

import { exec, spawn } from 'child_process';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 5173;
const platform = os.platform();

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function killPort(port) {
  return new Promise((resolve) => {
    log(`Checking for processes on port ${port}...`, 'yellow');

    let command;
    if (platform === 'win32') {
      // Windows
      command = `netstat -ano | findstr :${port}`;
    } else {
      // Linux/Mac
      command = `lsof -ti:${port}`;
    }

    exec(command, (error, stdout) => {
      if (error || !stdout.trim()) {
        log(`No process found on port ${port}`, 'yellow');
        resolve();
        return;
      }

      let killCmd;
      if (platform === 'win32') {
        // Extract PID from netstat output (last column)
        const lines = stdout.trim().split('\n');
        const pids = lines
          .map(line => line.trim().split(/\s+/).pop())
          .filter((pid, index, self) => pid && self.indexOf(pid) === index);

        if (pids.length === 0) {
          log(`No process found on port ${port}`, 'yellow');
          resolve();
          return;
        }

        killCmd = `taskkill /F /PID ${pids.join(' /PID ')}`;
      } else {
        // Handle multiple PIDs (one per line)
        const pids = stdout.trim().split('\n').filter(pid => pid);

        if (pids.length === 0) {
          log(`No process found on port ${port}`, 'yellow');
          resolve();
          return;
        }

        killCmd = `kill -9 ${pids.join(' ')}`;
      }

      exec(killCmd, (killError) => {
        if (killError) {
          log(`Error killing process on port ${port}: ${killError.message}`, 'red');
        } else {
          log(`Process on port ${port} killed`, 'green');
        }
        resolve();
      });
    });
  });
}

function killProcessByName(processName) {
  return new Promise((resolve) => {
    log(`Checking for ${processName} processes...`, 'yellow');

    let command;
    if (platform === 'win32') {
      command = `tasklist /FI "IMAGENAME eq ${processName}.exe"`;
    } else {
      command = `pgrep -f "${processName}"`;
    }

    exec(command, (error, stdout) => {
      if (error || !stdout.trim()) {
        log(`No ${processName} processes found`, 'yellow');
        resolve();
        return;
      }

      let killCmd;
      if (platform === 'win32') {
        killCmd = `taskkill /F /IM ${processName}.exe`;
      } else {
        killCmd = `pkill -f "${processName}"`;
      }

      exec(killCmd, (killError) => {
        if (killError) {
          log(`No ${processName} processes to kill`, 'yellow');
        } else {
          log(`${processName} processes killed`, 'green');
        }
        resolve();
      });
    });
  });
}

// Note: Using exec() here is safe as all commands are hardcoded developer tools
function killElectronProcesses() {
  return new Promise((resolve) => {
    log('Killing all Electron processes for this app...', 'yellow');

    if (platform === 'win32') {
      exec('taskkill /F /IM "Electron.exe" 2>nul', () => {
        resolve();
      });
    } else {
      // Kill all Electron Helper processes and main Electron process for this project
      const killCommands = [
        // Kill Electron Helper processes (Renderer, GPU, etc.)
        'pkill -9 -f "Electron Helper"',
        // Kill main Electron process from this project's node_modules
        `pkill -9 -f "${__dirname}/node_modules/electron"`,
        // Kill any electron process associated with StoreOS
        'pkill -9 -f "storeos"',
      ];

      let completed = 0;
      killCommands.forEach(cmd => {
        exec(cmd, () => {
          completed++;
          if (completed === killCommands.length) {
            log('Electron processes killed', 'green');
            resolve();
          }
        });
      });
    }
  });
}

async function stopApplication() {
  log('Stopping application...', 'yellow');

  // Kill all Electron processes first (more aggressive)
  await killElectronProcesses();

  // Kill port 5173 (Vite dev server)
  await killPort(PORT);

  // Also try the generic electron kill as backup
  await killProcessByName('electron');

  log('Waiting for processes to terminate...', 'yellow');
  await new Promise(resolve => setTimeout(resolve, 1500));
}

function startApplication() {
  log('Starting application...', 'green');

  const npmCmd = platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCmd, ['run', 'dev'], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });

  child.on('error', (error) => {
    log(`Error starting application: ${error.message}`, 'red');
    process.exit(1);
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      log(`Application exited with code ${code}`, 'red');
    }
  });
}

async function main() {
  try {
    await stopApplication();
    startApplication();
  } catch (error) {
    log(`Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
