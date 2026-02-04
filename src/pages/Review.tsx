import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || 'https://tradux-api.onrender.com/api';

interface ReviewData {
  order_number: string;
  customer_name: string;
  source_language: string;
  target_language: string;
  document_type: string;
  service_tier: string;
  cert_type: string;
  translation_status: string;
  proofread_text: string;
  original_text: string;
}

export default function Review() {
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState('');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  // Get order_id from URL path and token from query string
  const pathParts = window.location.pathname.split('/');
  const orderId = pathParts[pathParts.length - 1];
  const token = new URLSearchParams(window.location.search).get('token') || '';

  useEffect(() => {
    if (!orderId || !token) {
      setError('Invalid review link.');
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/review/${orderId}?token=${token}`)
      .then((resp) => {
        if (!resp.ok) throw new Error('Invalid or expired review link');
        return resp.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [orderId, token]);

  const handleSubmit = async (reviewAction: string) => {
    if (reviewAction === 'request_correction' && !correctionNotes.trim()) {
      toast.error('Please describe the corrections you need.');
      return;
    }
    setAction(reviewAction);
    try {
      const resp = await fetch(`${API_URL}/review/${orderId}?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          action: reviewAction,
          correction_notes: correctionNotes || undefined,
        }),
      });
      const result = await resp.json();
      if (resp.ok) {
        toast.success(result.message);
        setSubmitted(true);
      } else {
        toast.error(result.detail || 'Something went wrong');
      }
    } catch {
      toast.error('Failed to submit review');
    }
    setAction('');
  };

  if (loading) {
    return (
      <div className="review-page">
        <div className="review-card" style={{ textAlign: 'center' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#3182ce' }}></i>
          <p>Loading your translation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="review-page">
        <div className="review-card" style={{ textAlign: 'center' }}>
          <i className="fas fa-exclamation-triangle" style={{ fontSize: '2rem', color: '#e53e3e', marginBottom: '1rem', display: 'block' }}></i>
          <h2>Review Not Available</h2>
          <p style={{ color: '#718096' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="review-page">
        <div className="review-card" style={{ textAlign: 'center' }}>
          <i className="fas fa-check-circle" style={{ fontSize: '3rem', color: '#38a169', marginBottom: '1rem', display: 'block' }}></i>
          <h2>Thank You!</h2>
          <p style={{ color: '#718096' }}>Your response has been recorded. You'll receive an email confirmation shortly.</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="review-page">
      <div className="review-container">
        {/* Header */}
        <div className="review-header">
          <h1>TRADUX</h1>
          <span className="review-badge">Translation Review</span>
        </div>

        <div className="review-card">
          <h2>Review Your Translation</h2>
          <p style={{ color: '#718096', marginBottom: '1.5rem' }}>
            Dear <strong>{data.customer_name}</strong>, your translation for order <strong>{data.order_number}</strong> is ready.
            Please review it below and approve or request corrections.
          </p>

          {/* Order Info */}
          <div className="review-info-box">
            <div><strong>Order:</strong> {data.order_number}</div>
            <div><strong>Languages:</strong> {data.source_language} → {data.target_language}</div>
            <div><strong>Document:</strong> {data.document_type || 'N/A'}</div>
            <div><strong>Service:</strong> {data.service_tier?.charAt(0).toUpperCase() + data.service_tier?.slice(1)}</div>
          </div>

          {/* Toggle Original */}
          {data.original_text && (
            <div style={{ marginBottom: '1rem' }}>
              <button
                onClick={() => setShowOriginal(!showOriginal)}
                style={{ background: 'none', border: 'none', color: '#3182ce', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
              >
                <i className={`fas ${showOriginal ? 'fa-eye-slash' : 'fa-eye'}`}></i> {showOriginal ? 'Hide' : 'Show'} Original Text
              </button>
              {showOriginal && (
                <pre className="review-text-box" style={{ background: '#f7fafc' }}>
                  {data.original_text}
                </pre>
              )}
            </div>
          )}

          {/* Translation */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem' }}><i className="fas fa-language"></i> Translation</h3>
            {data.proofread_text && data.proofread_text.trim().startsWith('<!DOCTYPE') ? (
              <div style={{ border: '2px solid #c6f6d5', borderRadius: '10px', overflow: 'hidden', background: 'white' }}>
                <iframe
                  srcDoc={data.proofread_text}
                  title="Translation"
                  style={{ width: '100%', height: '600px', border: 'none' }}
                />
              </div>
            ) : (
              <pre className="review-text-box" style={{ background: '#f0fff4', border: '1px solid #c6f6d5' }}>
                {data.proofread_text || 'Translation not available.'}
              </pre>
            )}
          </div>

          {/* Actions */}
          <div className="review-actions">
            <button
              onClick={() => handleSubmit('approve')}
              disabled={!!action}
              className="btn-cert-primary review-approve-btn"
            >
              {action === 'approve' ? <><i className="fas fa-spinner fa-spin"></i> Submitting...</> : <><i className="fas fa-check"></i> Approve Translation</>}
            </button>

            <div className="review-correction-section">
              <h4><i className="fas fa-edit"></i> Request Corrections</h4>
              <textarea
                value={correctionNotes}
                onChange={(e) => setCorrectionNotes(e.target.value)}
                placeholder="Describe the corrections you need (e.g., name spelling, date format, missing content)..."
                rows={4}
                className="review-textarea"
              />
              <button
                onClick={() => handleSubmit('request_correction')}
                disabled={!!action}
                className="btn-cert-outline review-correction-btn"
              >
                {action === 'request_correction' ? <><i className="fas fa-spinner fa-spin"></i> Submitting...</> : <><i className="fas fa-redo"></i> Request Corrections</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
