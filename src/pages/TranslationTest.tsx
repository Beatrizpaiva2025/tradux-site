import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'wouter';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || 'https://tradux-api.onrender.com/api';

interface SampleDoc {
  key: string;
  name: string;
  type: string;
  source_language: string;
  preview: string;
}

interface Analysis {
  document_type?: string;
  source_language?: string;
  source_country?: string;
  detected_elements?: string[];
  is_financial?: boolean;
  estimated_pages?: number;
  summary?: string;
}

interface OrderData {
  id?: string;
  order_number?: string;
  translation_status?: string;
  document_analysis?: string;
  translation_html?: string;
  proofread_text?: string;
  translated_text?: string;
  ai_corrections?: string;
  original_text?: string;
  source_language?: string;
  target_language?: string;
  document_type?: string;
  service_tier?: string;
}

type PipelinePhase = 'idle' | 'creating' | 'translating' | 'proofreading' | 'pm_review' | 'error';

const DEFAULT_SAMPLE_DOCS: SampleDoc[] = [
  {
    key: 'birth_certificate_br',
    name: 'Certidao de Nascimento - Maria Silva',
    type: 'birth_certificate',
    source_language: 'portuguese',
    preview: 'REGISTRO CIVIL DE NASCIMENTO\nCERTIDAO DE NASCIMENTO\nNome: Maria Aparecida Silva Santos...',
  },
  {
    key: 'bank_statement_br',
    name: 'Extrato Bancario - Joao Silva',
    type: 'bank_statement',
    source_language: 'portuguese',
    preview: 'BANCO DO BRASIL S.A.\nEXTRATO DE CONTA CORRENTE\nAgencia: 1234-5 | Conta: 67890-1...',
  },
  {
    key: 'diploma_br',
    name: 'Diploma - Pedro Oliveira',
    type: 'diploma',
    source_language: 'portuguese',
    preview: 'UNIVERSIDADE FEDERAL DO RIO DE JANEIRO\nDIPLOMA\nConferimos o grau de Bacharel em Direito...',
  },
  {
    key: 'school_transcript_br',
    name: 'Historico Escolar - Ana Costa',
    type: 'transcript',
    source_language: 'portuguese',
    preview: 'HISTORICO ESCOLAR — ENSINO MEDIO\nAluna: Ana Beatriz Costa\nData de Nascimento: 15/03/2004...',
  },
];

const PHASES = [
  { key: 'analysis', label: 'Document Analysis', icon: 'fa-search', desc: 'Extracting metadata, language, elements' },
  { key: 'glossary', label: 'Glossary & Terminology', icon: 'fa-book', desc: 'Building document-specific terminology map' },
  { key: 'translation', label: 'Line-by-Line Translation', icon: 'fa-language', desc: 'Certified HTML translation with format conversions' },
  { key: 'review', label: 'Self-Review', icon: 'fa-check-double', desc: 'Validating completeness and accuracy' },
  { key: 'proofread', label: 'AI Proofreading', icon: 'fa-spell-check', desc: 'Senior-level proofreading and corrections' },
];

function getPhaseIndex(status: string): number {
  if (status === 'translating') return 2;
  if (status === 'proofreading') return 4;
  if (status === 'pm_review' || status === 'completed') return 5;
  if (status === 'translation_error') return -1;
  return 0;
}

export default function TranslationTest() {
  const [sampleDocs, setSampleDocs] = useState<SampleDoc[]>(DEFAULT_SAMPLE_DOCS);
  const [selectedDoc, setSelectedDoc] = useState('birth_certificate_br');
  const [customText, setCustomText] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [aiCommands, setAiCommands] = useState('');

  const [phase, setPhase] = useState<PipelinePhase>('idle');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [translationHtml, setTranslationHtml] = useState('');
  const [corrections, setCorrections] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Try to load sample documents from API (fallback to hardcoded defaults)
  useEffect(() => {
    fetch(`${API_URL}/admin/sample-documents`)
      .then((r) => r.json())
      .then((data) => {
        if (data.documents?.length) setSampleDocs(data.documents);
      })
      .catch(() => {});
  }, []);

  // Poll order status while pipeline is running
  useEffect(() => {
    if (!orderId || (phase !== 'translating' && phase !== 'proofreading')) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const poll = async () => {
      try {
        const resp = await fetch(`${API_URL}/admin/orders/${orderId}`);
        if (!resp.ok) return;
        const data = await resp.json();
        setOrder(data);

        const status = data.translation_status;
        if (status === 'translating') {
          setPhase('translating');
        } else if (status === 'proofreading') {
          setPhase('proofreading');
        } else if (status === 'pm_review' || status === 'client_review' || status === 'completed') {
          setPhase('pm_review');
          if (pollRef.current) clearInterval(pollRef.current);
          // Fetch the final HTML
          fetchTranslationResult(orderId);
        } else if (status === 'translation_error') {
          setPhase('error');
          setErrorMsg(data.translation_error || 'Translation pipeline failed.');
          if (pollRef.current) clearInterval(pollRef.current);
        }

        // Parse analysis
        if (data.document_analysis) {
          try {
            const parsed = typeof data.document_analysis === 'string'
              ? JSON.parse(data.document_analysis)
              : data.document_analysis;
            setAnalysis(parsed);
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    };

    poll();
    pollRef.current = setInterval(poll, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [orderId, phase]);

  const fetchTranslationResult = async (oid: string) => {
    try {
      const resp = await fetch(`${API_URL}/admin/orders/${oid}/translation-html`);
      if (!resp.ok) return;
      const data = await resp.json();
      setTranslationHtml(data.html || '');
      setCorrections(data.ai_corrections || '');
      if (data.document_analysis) {
        try {
          const parsed = typeof data.document_analysis === 'string'
            ? JSON.parse(data.document_analysis)
            : data.document_analysis;
          setAnalysis(parsed);
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  };

  const handleStartPipeline = useCallback(async () => {
    setPhase('creating');
    setErrorMsg('');
    setAnalysis(null);
    setTranslationHtml('');
    setCorrections('');
    setOrder(null);

    try {
      // Step 1: Create test order
      const createResp = await fetch(`${API_URL}/admin/create-test-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_key: useCustom ? 'custom' : selectedDoc,
          customer_name: 'Pipeline Test',
          customer_email: 'test@tradux.online',
          source_language: 'portuguese',
          target_language: 'english',
          custom_text: useCustom ? customText : undefined,
        }),
      });

      if (!createResp.ok) {
        const err = await createResp.json().catch(() => ({ detail: 'Failed to create test order' }));
        throw new Error(err.detail || 'Failed to create test order');
      }

      const createData = await createResp.json();
      const oid = createData.order_id;
      setOrderId(oid);
      toast.success(`Test order created: ${createData.order_number}`);

      // Step 2: Start translation pipeline
      const startResp = await fetch(`${API_URL}/admin/start-translation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: oid,
          ai_commands: aiCommands || undefined,
        }),
      });

      if (!startResp.ok) {
        const err = await startResp.json().catch(() => ({ detail: 'Failed to start pipeline' }));
        throw new Error(err.detail || 'Failed to start pipeline');
      }

      setPhase('translating');
      toast.success('Pipeline started! Watching progress...');
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Something went wrong';
      const message = raw === 'Failed to fetch'
        ? 'Cannot reach the backend API. The server may be starting up (Render free tier can take ~30s). Please wait a moment and try again.'
        : raw;
      toast.error(message);
      setPhase('error');
      setErrorMsg(message);
    }
  }, [selectedDoc, useCustom, customText, aiCommands]);

  const handleReset = () => {
    setPhase('idle');
    setOrderId(null);
    setOrder(null);
    setAnalysis(null);
    setTranslationHtml('');
    setCorrections('');
    setErrorMsg('');
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const handlePrintHtml = () => {
    if (!iframeRef.current) return;
    iframeRef.current.contentWindow?.print();
  };

  const handleOpenNewTab = () => {
    if (!translationHtml) return;
    const blob = new Blob([translationHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const phaseIndex = order ? getPhaseIndex(order.translation_status || '') : (phase === 'creating' ? 0 : -1);
  const isRunning = phase === 'creating' || phase === 'translating' || phase === 'proofreading';
  const isDone = phase === 'pm_review';

  const selectedSample = sampleDocs.find((d) => d.key === selectedDoc);

  return (
    <>
      <header className="tt-header">
        <nav className="container">
          <div className="logo">
            <Link href="/">
              <span className="logo-text">TRADUX</span>
              <span className="logo-badge">Pipeline Test</span>
            </Link>
          </div>
          <div className="tt-header-right">
            <Link href="/admin" className="tt-back-link">
              <i className="fas fa-cog"></i> Admin
            </Link>
            <Link href="/" className="tt-back-link">
              <i className="fas fa-arrow-left"></i> Home
            </Link>
          </div>
        </nav>
      </header>

      <main className="tt-main">
        <div className="container">
          <div className="tt-title-area">
            <h1><i className="fas fa-flask"></i> Certified Translation Pipeline Test</h1>
            <p>Full 5-phase pipeline: Analysis, Glossary, Certified Translation, Self-Review, Proofreading</p>
          </div>

          {/* ========== STEP 1: CONFIG ========== */}
          {!isRunning && !isDone && phase !== 'error' && (
            <div className="tt-config">
              {/* Document Selection */}
              <div className="tt-config-section">
                <h3><i className="fas fa-file-alt"></i> Select Document</h3>

                <div className="tt-doc-toggle">
                  <button
                    className={`tt-toggle-btn ${!useCustom ? 'active' : ''}`}
                    onClick={() => setUseCustom(false)}
                  >
                    <i className="fas fa-database"></i> Sample Documents
                  </button>
                  <button
                    className={`tt-toggle-btn ${useCustom ? 'active' : ''}`}
                    onClick={() => setUseCustom(true)}
                  >
                    <i className="fas fa-edit"></i> Custom Text
                  </button>
                </div>

                {!useCustom ? (
                  <div className="tt-doc-grid">
                    {sampleDocs.map((doc) => (
                      <button
                        key={doc.key}
                        className={`tt-doc-card ${selectedDoc === doc.key ? 'selected' : ''}`}
                        onClick={() => setSelectedDoc(doc.key)}
                      >
                        <div className="tt-doc-card-icon">
                          {doc.type === 'birth_certificate' && <i className="fas fa-baby"></i>}
                          {doc.type === 'bank_statement' && <i className="fas fa-university"></i>}
                          {doc.type === 'diploma' && <i className="fas fa-graduation-cap"></i>}
                          {doc.type === 'transcript' && <i className="fas fa-list-alt"></i>}
                          {!['birth_certificate', 'bank_statement', 'diploma', 'transcript'].includes(doc.type) && <i className="fas fa-file"></i>}
                        </div>
                        <div className="tt-doc-card-info">
                          <strong>{doc.name}</strong>
                          <small>{doc.type.replace(/_/g, ' ')}</small>
                        </div>
                        {selectedDoc === doc.key && <i className="fas fa-check-circle tt-doc-check"></i>}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    className="tt-custom-textarea"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Paste your document text here (Portuguese)..."
                    rows={8}
                  />
                )}

                {!useCustom && selectedSample && (
                  <div className="tt-doc-preview">
                    <strong>Preview:</strong>
                    <pre>{selectedSample.preview}</pre>
                  </div>
                )}
              </div>

              {/* AI Commands */}
              <div className="tt-config-section">
                <h3><i className="fas fa-robot"></i> AI Instructions <small>(optional)</small></h3>
                <textarea
                  className="tt-ai-commands"
                  value={aiCommands}
                  onChange={(e) => setAiCommands(e.target.value)}
                  placeholder="e.g., 'Use formal legal terminology', 'Include translator notes for all acronyms'..."
                  rows={3}
                />
              </div>

              {/* Pipeline Info */}
              <div className="tt-pipeline-info">
                <h3><i className="fas fa-project-diagram"></i> Pipeline Phases</h3>
                <div className="tt-phases-preview">
                  {PHASES.map((p, i) => (
                    <div key={p.key} className="tt-phase-preview-item">
                      <span className="tt-phase-num">{i + 1}</span>
                      <i className={`fas ${p.icon}`}></i>
                      <div>
                        <strong>{p.label}</strong>
                        <small>{p.desc}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Start Button */}
              <div className="tt-action-row">
                <button
                  className="tt-start-btn"
                  onClick={handleStartPipeline}
                  disabled={useCustom && !customText.trim()}
                >
                  <i className="fas fa-play"></i> Start Full Translation Pipeline
                </button>
              </div>
            </div>
          )}

          {/* ========== STEP 2: PIPELINE RUNNING ========== */}
          {(isRunning || isDone || phase === 'error') && (
            <div className="tt-pipeline">
              {/* Phase Progress */}
              <div className="tt-progress-section">
                <h3>
                  {isDone ? (
                    <><i className="fas fa-check-circle" style={{ color: '#38a169' }}></i> Pipeline Complete</>
                  ) : phase === 'error' ? (
                    <><i className="fas fa-exclamation-triangle" style={{ color: '#e53e3e' }}></i> Pipeline Error</>
                  ) : (
                    <><i className="fas fa-spinner fa-spin" style={{ color: '#3182ce' }}></i> Pipeline Running...</>
                  )}
                </h3>

                <div className="tt-phases-track">
                  {PHASES.map((p, i) => {
                    let status: 'done' | 'active' | 'pending' | 'error' = 'pending';
                    if (phase === 'error' && phaseIndex >= 0 && i === phaseIndex) status = 'error';
                    else if (i < phaseIndex) status = 'done';
                    else if (i === phaseIndex && !isDone) status = 'active';
                    else if (isDone) status = 'done';

                    return (
                      <div key={p.key} className={`tt-phase-step ${status}`}>
                        <div className="tt-phase-indicator">
                          {status === 'done' && <i className="fas fa-check"></i>}
                          {status === 'active' && <i className="fas fa-spinner fa-spin"></i>}
                          {status === 'error' && <i className="fas fa-times"></i>}
                          {status === 'pending' && <span>{i + 1}</span>}
                        </div>
                        <div className="tt-phase-label">
                          <strong>{p.label}</strong>
                          <small>{p.desc}</small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Error */}
              {phase === 'error' && (
                <div className="tt-error-box">
                  <i className="fas fa-exclamation-circle"></i>
                  <div>
                    <strong>Error</strong>
                    <p>{errorMsg}</p>
                  </div>
                  <button className="tt-retry-btn" onClick={handleReset}>
                    <i className="fas fa-redo"></i> Try Again
                  </button>
                </div>
              )}

              {/* Document Analysis */}
              {analysis && (
                <div className="tt-result-section">
                  <h3><i className="fas fa-search"></i> Phase 1: Document Analysis</h3>
                  <div className="tt-analysis-grid">
                    {analysis.document_type && (
                      <div className="tt-analysis-item">
                        <label>Document Type</label>
                        <span>{analysis.document_type.replace(/_/g, ' ')}</span>
                      </div>
                    )}
                    {analysis.source_language && (
                      <div className="tt-analysis-item">
                        <label>Language</label>
                        <span>{analysis.source_language}</span>
                      </div>
                    )}
                    {analysis.source_country && (
                      <div className="tt-analysis-item">
                        <label>Country</label>
                        <span>{analysis.source_country}</span>
                      </div>
                    )}
                    {analysis.is_financial !== undefined && (
                      <div className="tt-analysis-item">
                        <label>Financial</label>
                        <span>{analysis.is_financial ? 'Yes' : 'No'}</span>
                      </div>
                    )}
                    {analysis.estimated_pages && (
                      <div className="tt-analysis-item">
                        <label>Est. Pages</label>
                        <span>{analysis.estimated_pages}</span>
                      </div>
                    )}
                    {analysis.detected_elements && analysis.detected_elements.length > 0 && (
                      <div className="tt-analysis-item tt-analysis-wide">
                        <label>Detected Elements</label>
                        <div className="tt-element-tags">
                          {analysis.detected_elements.map((el) => (
                            <span key={el} className="tt-element-tag">{el}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {analysis.summary && (
                      <div className="tt-analysis-item tt-analysis-wide">
                        <label>Summary</label>
                        <span>{analysis.summary}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Translation HTML Preview */}
              {isDone && translationHtml && (
                <div className="tt-result-section">
                  <h3>
                    <i className="fas fa-file-code"></i> Certified Translation (HTML)
                    <div className="tt-html-actions">
                      <button onClick={handleOpenNewTab} title="Open in new tab">
                        <i className="fas fa-external-link-alt"></i> Open
                      </button>
                      <button onClick={handlePrintHtml} title="Print / Save PDF">
                        <i className="fas fa-print"></i> Print
                      </button>
                    </div>
                  </h3>
                  <div className="tt-html-preview">
                    <iframe
                      ref={iframeRef}
                      srcDoc={translationHtml}
                      title="Translation Preview"
                      className="tt-html-iframe"
                    />
                  </div>
                </div>
              )}

              {/* AI Corrections */}
              {isDone && corrections && (
                <div className="tt-result-section">
                  <h3><i className="fas fa-spell-check"></i> Phase 5: Proofreading Corrections</h3>
                  <div className="tt-corrections-box">
                    <pre>{corrections}</pre>
                  </div>
                </div>
              )}

              {/* Reset */}
              {isDone && (
                <div className="tt-action-row">
                  <button className="tt-start-btn tt-reset-btn" onClick={handleReset}>
                    <i className="fas fa-redo"></i> Run Another Test
                  </button>
                  <Link href="/" className="btn-cert-primary">
                    <i className="fas fa-shopping-cart"></i> Order Certified Translation
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
