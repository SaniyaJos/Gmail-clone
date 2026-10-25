import sys
import os
import json
import warnings
import pickle

warnings.filterwarnings('ignore')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, 'model.pkl')
VECTORIZER_PATH = os.path.join(BASE_DIR, 'vectorizer.pkl')

def load_artifacts():
    with open(MODEL_PATH, 'rb') as f:
        model = pickle.load(f)
    with open(VECTORIZER_PATH, 'rb') as f:
        vectorizer = pickle.load(f)
    return model, vectorizer

def classify_text(model, vectorizer, text):
    if not text or not text.strip():
        return {"isSpam": False, "confidence": 1.0, "label": "HAM"}
    
    X = vectorizer.transform([text.strip()[:1000]])
    proba = model.predict_proba(X)[0]
    
    # Class 1 is spam, Class 0 is ham
    spam_idx = 1
    classes = list(model.classes_)
    if 1 in classes:
        spam_idx = classes.index(1)
    elif 'spam' in classes:
        spam_idx = classes.index('spam')
    
    spam_prob = float(proba[spam_idx])
    is_spam = bool(spam_prob >= 0.5)
    
    return {
        "isSpam": is_spam,
        "confidence": spam_prob if is_spam else float(1.0 - spam_prob),
        "label": "SPAM" if is_spam else "HAM"
    }

def main():
    try:
        model, vectorizer = load_artifacts()
    except Exception as e:
        print(json.dumps({"error": f"Failed to load model/vectorizer: {str(e)}", "isSpam": False}))
        sys.exit(1)

    # If --daemon or --worker is passed, read JSON lines from stdin continuously for ultra-fast response
    if len(sys.argv) > 1 and sys.argv[1] == '--daemon':
        sys.stdout.write("READY\n")
        sys.stdout.flush()
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            if line == "PING":
                sys.stdout.write("PONG\n")
                sys.stdout.flush()
                continue
            try:
                data = json.loads(line)
                text = data.get("text", "")
                result = classify_text(model, vectorizer, text)
                sys.stdout.write(json.dumps(result) + "\n")
                sys.stdout.flush()
            except Exception as ex:
                sys.stdout.write(json.dumps({"error": str(ex), "isSpam": False}) + "\n")
                sys.stdout.flush()
        return

    # Single-shot mode: read from stdin or argv
    text = ""
    if len(sys.argv) > 1:
        text = " ".join(sys.argv[1:])
    else:
        text = sys.stdin.read()

    result = classify_text(model, vectorizer, text)
    print(json.dumps(result))

if __name__ == '__main__':
    main()
