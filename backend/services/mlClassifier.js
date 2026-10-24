/**
 * Machine Learning Spam Classifier Service
 * Uses Hugging Face Transformers ONNX runtime in pure Node.js (@xenova/transformers).
 * Model: onnx-community/OTIS-Official-Spam-Model-ONNX
 * No Python server required!
 */

let classifierPromise = null;

async function getClassifier() {
  if (!classifierPromise) {
    classifierPromise = (async () => {
      try {
        const { pipeline, env } = await import('@xenova/transformers');

        // Allow local caching in node_modules or cache folder
        env.allowRemoteModels = true;

        const classifier = await pipeline(
          'text-classification',
          'onnx-community/OTIS-Official-Spam-Model-ONNX'
        );

        // Ensure proper label mapping for the model output
        if (classifier.model && classifier.model.config) {
          classifier.model.config.id2label = { 0: 'HAM', 1: 'SPAM' };
        }

        console.log('[ML Spam Classifier] Pre-trained ONNX spam detection model loaded successfully.');
        return classifier;
      } catch (err) {
        console.error('[ML Spam Classifier] Failed to initialize model:', err.message);
        classifierPromise = null;
        return null;
      }
    })();
  }
  return classifierPromise;
}

// Pre-warm the classifier in the background at startup
getClassifier().catch(() => {});

/**
 * Classifies input text as SPAM or HAM using the ML model.
 * @param {string} text - Email subject and body combined
 * @returns {Promise<{ isSpam: boolean, confidence: number, label: string }>}
 */
async function classifyWithML(text) {
  if (!text || !text.trim()) {
    return { isSpam: false, confidence: 1.0, label: 'HAM' };
  }

  try {
    const classifier = await getClassifier();
    if (!classifier) {
      return { isSpam: false, confidence: 0, label: 'UNKNOWN', error: true };
    }

    // Truncate to first 512 characters for fast and robust inference
    const trimmed = text.trim().slice(0, 512);
    const results = await classifier(trimmed);

    if (Array.isArray(results) && results.length > 0) {
      const top = results[0];
      const isSpam = top.label === 'SPAM';
      return {
        isSpam,
        confidence: top.score,
        label: top.label
      };
    }
  } catch (err) {
    console.error('[ML Spam Classifier] Inference error:', err.message);
  }

  return { isSpam: false, confidence: 0, label: 'UNKNOWN', error: true };
}

module.exports = {
  classifyWithML,
  getClassifier
};
