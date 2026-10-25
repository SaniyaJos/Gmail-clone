/**
 * Machine Learning Spam Classifier Service
 * Uses custom trained Scikit-Learn model (model.pkl + vectorizer.pkl) located in backend/ml/.
 * Communicates with backend/ml/predict.py via Python subprocess.
 */

const path = require('path');
const { spawn } = require('child_process');

const SCRIPT_PATH = path.join(__dirname, '..', 'ml', 'predict.py');
const PYTHON_CMD = process.env.PYTHON_PATH || 'python';

let daemonProcess = null;
let isDaemonReady = false;
let pendingQueue = [];
let daemonSpawnPromise = null;

/**
 * Initializes and maintains a persistent Python worker process
 * for near-instant (sub-10ms) spam classification inference.
 */
function getDaemonProcess() {
  if (daemonProcess && !daemonProcess.killed && isDaemonReady) {
    return Promise.resolve(daemonProcess);
  }

  if (daemonSpawnPromise) {
    return daemonSpawnPromise;
  }

  daemonSpawnPromise = new Promise((resolve) => {
    try {
      daemonProcess = spawn(PYTHON_CMD, [SCRIPT_PATH, '--daemon'], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'inherit'],
        windowsHide: true
      });

      let buffer = '';

      daemonProcess.stdout.on('data', (chunk) => {
        buffer += chunk.toString('utf-8');
        let newlineIndex;

        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (!line) continue;

          if (line === 'READY') {
            isDaemonReady = true;
            console.log('[ML Spam Classifier] Custom scikit-learn model (model.pkl + vectorizer.pkl) loaded successfully.');
            resolve(daemonProcess);
            continue;
          }

          if (pendingQueue.length > 0) {
            const { resolve: reqResolve, timer } = pendingQueue.shift();
            clearTimeout(timer);
            try {
              const parsed = JSON.parse(line);
              reqResolve(parsed);
            } catch (err) {
              reqResolve({ isSpam: false, confidence: 0, label: 'UNKNOWN', error: true });
            }
          }
        }
      });

      daemonProcess.on('error', (err) => {
        console.warn('[ML Spam Classifier] Python daemon error:', err.message);
        isDaemonReady = false;
        daemonProcess = null;
        daemonSpawnPromise = null;
        resolve(null);
      });

      daemonProcess.on('exit', (code) => {
        isDaemonReady = false;
        daemonProcess = null;
        daemonSpawnPromise = null;
        // Flush any pending requests
        while (pendingQueue.length > 0) {
          const { resolve: reqResolve, timer } = pendingQueue.shift();
          clearTimeout(timer);
          reqResolve({ isSpam: false, confidence: 0, label: 'UNKNOWN', error: true });
        }
      });

      // Timeout fallback if python is slow to respond on first load
      setTimeout(() => {
        if (!isDaemonReady) {
          resolve(null);
        }
      }, 4000);
    } catch (err) {
      console.warn('[ML Spam Classifier] Could not start Python daemon:', err.message);
      resolve(null);
    }
  });

  return daemonSpawnPromise;
}

// Pre-warm the custom model worker at server startup
getDaemonProcess().catch(() => {});

/**
 * Fallback one-shot Python execution if daemon is unavailable.
 */
function classifySingleShot(text) {
  return new Promise((resolve) => {
    try {
      const child = spawn(PYTHON_CMD, [SCRIPT_PATH], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      let stdout = '';
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            const result = JSON.parse(stdout.trim());
            return resolve(result);
          } catch (e) {}
        }
        resolve({ isSpam: false, confidence: 0, label: 'UNKNOWN', error: true });
      });
      child.on('error', () => {
        resolve({ isSpam: false, confidence: 0, label: 'UNKNOWN', error: true });
      });

      child.stdin.write(text || '');
      child.stdin.end();
    } catch (err) {
      resolve({ isSpam: false, confidence: 0, label: 'UNKNOWN', error: true });
    }
  });
}

/**
 * Classifies input text as SPAM or HAM using backend/ml/model.pkl and backend/ml/vectorizer.pkl.
 * @param {string} text - Email subject and body combined
 * @returns {Promise<{ isSpam: boolean, confidence: number, label: string }>}
 */
async function classifyWithML(text) {
  if (!text || !text.trim()) {
    return { isSpam: false, confidence: 1.0, label: 'HAM' };
  }

  const cleanText = text.trim().slice(0, 2000);

  try {
    const daemon = await getDaemonProcess();

    if (daemon && isDaemonReady && daemon.stdin && !daemon.killed) {
      return await new Promise((resolve) => {
        const timer = setTimeout(() => {
          // If request times out, fall back
          const idx = pendingQueue.findIndex((p) => p.timer === timer);
          if (idx !== -1) pendingQueue.splice(idx, 1);
          classifySingleShot(cleanText).then(resolve);
        }, 2000);

        pendingQueue.push({ resolve, timer });
        daemon.stdin.write(JSON.stringify({ text: cleanText }) + '\n');
      });
    }

    // Single-shot fallback
    return await classifySingleShot(cleanText);
  } catch (err) {
    console.error('[ML Spam Classifier] Inference error:', err.message);
    return { isSpam: false, confidence: 0, label: 'UNKNOWN', error: true };
  }
}

module.exports = {
  classifyWithML,
  getClassifier: getDaemonProcess
};
