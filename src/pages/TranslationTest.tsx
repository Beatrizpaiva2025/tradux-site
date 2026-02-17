import { useState, useCallback } from 'react';
import { Link } from 'wouter';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || 'https://tradux-api.onrender.com/api';

const LANGUAGES = [
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'english', label: 'English' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'french', label: 'French' },
  { value: 'german', label: 'German' },
  { value: 'italian', label: 'Italian' },
  { value: 'chinese', label: 'Chinese (Simplified)' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'korean', label: 'Korean' },
  { value: 'arabic', label: 'Arabic' },
  { value: 'russian', label: 'Russian' },
  { value: 'dutch', label: 'Dutch' },
  { value: 'turkish', label: 'Turkish' },
];

export default function TranslationTest() {
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('portuguese');
  const [targetLang, setTargetLang] = useState('english');
  const [loading, setLoading] = useState(false);
  const [tokensUsed, setTokensUsed] = useState<number | null>(null);

  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim()) {
      toast.error('Please enter text to translate.');
      return;
    }
    if (sourceLang === targetLang) {
      toast.error('Source and target languages must be different.');
      return;
    }

    setLoading(true);
    setTranslatedText('');
    setTokensUsed(null);

    try {
      const resp = await fetch(`${API_URL}/translate-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sourceText,
          source_language: sourceLang,
          target_language: targetLang,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: 'Translation failed' }));
        throw new Error(err.detail || 'Translation failed');
      }

      const data = await resp.json();
      setTranslatedText(data.translated_text);
      setTokensUsed(data.tokens_used);
      toast.success('Translation completed!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [sourceText, sourceLang, targetLang]);

  const handleSwapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    if (translatedText) {
      setSourceText(translatedText);
      setTranslatedText(sourceText);
    }
  };

  const handleCopy = () => {
    if (translatedText) {
      navigator.clipboard.writeText(translatedText);
      toast.success('Copied to clipboard!');
    }
  };

  const charCount = sourceText.length;
  const wordCount = sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0;

  return (
    <>
      {/* Header */}
      <header className="tt-header">
        <nav className="container">
          <div className="logo">
            <Link href="/">
              <span className="logo-text">TRADUX</span>
              <span className="logo-badge">Test</span>
            </Link>
          </div>
          <div className="tt-header-right">
            <Link href="/" className="tt-back-link">
              <i className="fas fa-arrow-left"></i> Back to Home
            </Link>
          </div>
        </nav>
      </header>

      {/* Main */}
      <main className="tt-main">
        <div className="container">
          <div className="tt-title-area">
            <h1><i className="fas fa-language"></i> Translation Test</h1>
            <p>Test our AI-powered translation engine. Enter text below and see the result instantly.</p>
          </div>

          {/* Language Selector Row */}
          <div className="tt-lang-row">
            <div className="tt-lang-select">
              <label htmlFor="tt-source-lang">From</label>
              <select
                id="tt-source-lang"
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            <button className="tt-swap-btn" onClick={handleSwapLanguages} title="Swap languages">
              <i className="fas fa-exchange-alt"></i>
            </button>

            <div className="tt-lang-select">
              <label htmlFor="tt-target-lang">To</label>
              <select
                id="tt-target-lang"
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Translation Panels */}
          <div className="tt-panels">
            {/* Source Panel */}
            <div className="tt-panel">
              <div className="tt-panel-header">
                <span className="tt-panel-label">
                  <i className="fas fa-file-alt"></i> Source Text
                </span>
                <span className="tt-char-count">{wordCount} words / {charCount} chars</span>
              </div>
              <textarea
                className="tt-textarea"
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Type or paste your text here..."
                rows={10}
                maxLength={10000}
              />
              {sourceText && (
                <button className="tt-clear-btn" onClick={() => { setSourceText(''); setTranslatedText(''); setTokensUsed(null); }}>
                  <i className="fas fa-times"></i> Clear
                </button>
              )}
            </div>

            {/* Result Panel */}
            <div className="tt-panel tt-panel-result">
              <div className="tt-panel-header">
                <span className="tt-panel-label">
                  <i className="fas fa-check-circle"></i> Translation
                </span>
                {tokensUsed && (
                  <span className="tt-tokens-badge">
                    <i className="fas fa-microchip"></i> {tokensUsed} tokens
                  </span>
                )}
              </div>
              <div className="tt-result-area">
                {loading ? (
                  <div className="tt-loading">
                    <i className="fas fa-spinner fa-spin"></i>
                    <span>Translating...</span>
                  </div>
                ) : translatedText ? (
                  <div className="tt-result-text">{translatedText}</div>
                ) : (
                  <div className="tt-placeholder">
                    <i className="fas fa-language"></i>
                    <span>Translation will appear here</span>
                  </div>
                )}
              </div>
              {translatedText && (
                <button className="tt-copy-btn" onClick={handleCopy}>
                  <i className="fas fa-copy"></i> Copy
                </button>
              )}
            </div>
          </div>

          {/* Translate Button */}
          <div className="tt-action-row">
            <button
              className={`tt-translate-btn ${loading ? 'loading' : ''}`}
              onClick={handleTranslate}
              disabled={loading || !sourceText.trim()}
            >
              {loading ? (
                <><i className="fas fa-spinner fa-spin"></i> Translating...</>
              ) : (
                <><i className="fas fa-language"></i> Translate</>
              )}
            </button>
          </div>

          {/* Info */}
          <div className="tt-info">
            <div className="tt-info-card">
              <i className="fas fa-robot"></i>
              <div>
                <strong>AI-Powered</strong>
                <small>Powered by Claude AI for accurate translations</small>
              </div>
            </div>
            <div className="tt-info-card">
              <i className="fas fa-globe"></i>
              <div>
                <strong>13+ Languages</strong>
                <small>Support for major world languages</small>
              </div>
            </div>
            <div className="tt-info-card">
              <i className="fas fa-shield-alt"></i>
              <div>
                <strong>Secure</strong>
                <small>Your text is encrypted and not stored</small>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="tt-cta">
            <p>Need a <strong>certified translation</strong> for official documents?</p>
            <Link href="/" className="btn-cert-primary">
              <i className="fas fa-shopping-cart"></i> Order Certified Translation
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
