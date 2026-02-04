import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || 'https://tradux-api.onrender.com/api';

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  service_tier: string;
  cert_type: string;
  source_language: string;
  target_language: string;
  document_type: string;
  page_count: number;
  total_price: number;
  payment_status: string;
  translation_status: string;
  original_text: string;
  translated_text: string;
  translation_html: string;
  proofread_text: string;
  ai_corrections: string;
  document_analysis: string;
  pm_approved: boolean;
  client_approved: boolean;
  correction_notes: string;
  created_at: string;
  document_ids: string[];
  is_test?: boolean;
  pm_upload_filename?: string;
  pm_upload_file_size?: number;
  pm_uploaded_at?: string;
}

interface Stats {
  total_orders: number;
  paid_orders: number;
  completed: number;
  in_progress: number;
  pending_pm_review: number;
  corrections_requested: number;
  total_revenue: number;
}

interface SampleDoc {
  key: string;
  name: string;
  type: string;
  source_language: string;
  preview: string;
}

const STATUS_COLORS: Record<string, string> = {
  received: '#3182ce',
  translating: '#805ad5',
  proofreading: '#d69e2e',
  pm_review: '#dd6b20',
  client_review: '#38a169',
  corrections: '#e53e3e',
  approved: '#2f855a',
  completed: '#276749',
  translation_error: '#c53030',
  pm_upload_ready: '#10b981',
  final: '#065f46',
};

const STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  translating: 'AI Translating',
  proofreading: 'AI Proofreading',
  pm_review: 'PM Review',
  client_review: 'Client Review',
  corrections: 'Corrections Needed',
  approved: 'Client Approved',
  completed: 'Completed',
  translation_error: 'Error',
  pm_upload_ready: 'READY',
  final: 'FINAL',
};

export default function Admin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [aiCommands, setAiCommands] = useState('');
  const [activeTab, setActiveTab] = useState<'pipeline' | 'upload'>('pipeline');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Test order creation
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [sampleDocs, setSampleDocs] = useState<SampleDoc[]>([]);
  const [selectedSample, setSelectedSample] = useState('birth_certificate_br');
  const [testCustomText, setTestCustomText] = useState('');
  const [testName, setTestName] = useState('Test Customer');
  const [testEmail] = useState('test@example.com');

  // HTML editing
  const [editingHtml, setEditingHtml] = useState(false);
  const [editHtmlContent, setEditHtmlContent] = useState('');
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);

  // Document upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-refresh for in-progress translations
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const url = filterStatus ? `${API_URL}/admin/orders?status=${filterStatus}` : `${API_URL}/admin/orders`;
      const resp = await fetch(url);
      const data = await resp.json();
      setOrders(data.orders || []);
    } catch {
      toast.error('Failed to load orders');
    }
  }, [filterStatus]);

  const fetchStats = useCallback(async () => {
    try {
      const resp = await fetch(`${API_URL}/admin/stats`);
      setStats(await resp.json());
    } catch { /* ignore */ }
  }, []);

  const fetchSampleDocs = useCallback(async () => {
    try {
      const resp = await fetch(`${API_URL}/admin/sample-documents`);
      const data = await resp.json();
      setSampleDocs(data.documents || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchOrders(), fetchStats(), fetchSampleDocs()]).finally(() => setLoading(false));
  }, [fetchOrders, fetchStats, fetchSampleDocs]);

  // Auto-refresh when translation is in progress
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (selectedOrder && ['translating', 'proofreading'].includes(selectedOrder.translation_status)) {
        loadOrder(selectedOrder.id);
        fetchOrders();
      } else {
        setAutoRefresh(false);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedOrder]);

  const loadOrder = async (orderId: string) => {
    try {
      const resp = await fetch(`${API_URL}/admin/orders/${orderId}`);
      const data = await resp.json();
      setSelectedOrder(data);
      // Enable auto-refresh if translation is in progress
      if (['translating', 'proofreading'].includes(data.translation_status)) {
        setAutoRefresh(true);
      }
    } catch {
      toast.error('Failed to load order');
    }
  };

  const createTestOrder = async () => {
    setActionLoading('create-test');
    try {
      const body: Record<string, string> = {
        document_key: selectedSample,
        customer_name: testName,
        customer_email: testEmail,
      };
      if (testCustomText.trim()) {
        body.custom_text = testCustomText;
      }
      const resp = await fetch(`${API_URL}/admin/create-test-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (resp.ok) {
        toast.success(`Test order ${data.order_number} created!`);
        await fetchOrders();
        await fetchStats();
        // Auto-select the new order
        if (data.order_id) {
          await loadOrder(data.order_id);
        }
        setShowTestPanel(false);
      } else {
        toast.error(data.detail || 'Failed to create test order');
      }
    } catch {
      toast.error('Failed to create test order');
    }
    setActionLoading('');
  };

  const startTranslation = async (orderId: string) => {
    setActionLoading('start');
    try {
      const resp = await fetch(`${API_URL}/admin/start-translation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, ai_commands: aiCommands }),
      });
      const data = await resp.json();
      if (resp.ok) {
        toast.success('Translation pipeline started! Auto-refreshing...');
        setAutoRefresh(true);
        await loadOrder(orderId);
        fetchOrders();
      } else {
        toast.error(data.detail || 'Failed to start');
      }
    } catch {
      toast.error('Failed to start translation');
    }
    setActionLoading('');
  };

  const reTranslate = async (orderId: string) => {
    setActionLoading('re-translate');
    try {
      const resp = await fetch(`${API_URL}/admin/re-translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, ai_commands: aiCommands }),
      });
      const data = await resp.json();
      if (resp.ok) {
        toast.success('Re-translation started!');
        setAutoRefresh(true);
        await loadOrder(orderId);
        fetchOrders();
      } else {
        toast.error(data.detail || 'Failed to re-translate');
      }
    } catch {
      toast.error('Failed to re-translate');
    }
    setActionLoading('');
  };

  const approvePM = async (orderId: string) => {
    setActionLoading('approve');
    try {
      const resp = await fetch(`${API_URL}/admin/approve-pm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, action: 'approve_pm' }),
      });
      if (resp.ok) {
        toast.success('Sent to client for review!');
        await loadOrder(orderId);
        fetchOrders();
      }
    } catch {
      toast.error('Failed to approve');
    }
    setActionLoading('');
  };

  const markComplete = async (orderId: string) => {
    setActionLoading('complete');
    try {
      const resp = await fetch(`${API_URL}/admin/mark-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, action: 'mark_complete' }),
      });
      if (resp.ok) {
        toast.success('Order marked as completed!');
        await loadOrder(orderId);
        fetchOrders();
        fetchStats();
      }
    } catch {
      toast.error('Failed to complete');
    }
    setActionLoading('');
  };

  const saveHtmlEdit = async (orderId: string) => {
    setActionLoading('save-html');
    try {
      const resp = await fetch(`${API_URL}/admin/update-translation-html`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, html: editHtmlContent }),
      });
      if (resp.ok) {
        toast.success('Translation HTML updated!');
        setEditingHtml(false);
        await loadOrder(orderId);
      } else {
        toast.error('Failed to save HTML');
      }
    } catch {
      toast.error('Failed to save HTML');
    }
    setActionLoading('');
  };

  const uploadDocumentToOrder = async (orderId: string, file: File) => {
    setActionLoading('upload');
    try {
      const formData = new FormData();
      formData.append('order_id', orderId);
      formData.append('file', file);
      const resp = await fetch(`${API_URL}/admin/upload-document-to-order`, {
        method: 'POST',
        body: formData,
      });
      const data = await resp.json();
      if (resp.ok) {
        toast.success(`Document uploaded! ${data.word_count} words extracted (${data.extraction_method})`);
        await loadOrder(orderId);
      } else {
        toast.error(data.detail || 'Upload failed');
      }
    } catch {
      toast.error('Failed to upload document');
    }
    setActionLoading('');
  };

  const uploadPmTranslation = async (orderId: string) => {
    if (!uploadFile) {
      toast.error('Please select a file first');
      return;
    }
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('order_id', orderId);
      formData.append('file', uploadFile);
      const resp = await fetch(`${API_URL}/admin/upload-pm-translation`, {
        method: 'POST',
        body: formData,
      });
      const data = await resp.json();
      if (resp.ok) {
        toast.success('Translation uploaded! Status set to READY.');
        setUploadFile(null);
        await loadOrder(orderId);
        fetchOrders();
      } else {
        toast.error(data.detail || 'Upload failed');
      }
    } catch {
      toast.error('Failed to upload translation');
    }
    setUploadLoading(false);
  };

  const acceptPmUpload = async (orderId: string) => {
    setActionLoading('accept_upload');
    try {
      const resp = await fetch(`${API_URL}/admin/accept-pm-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, action: 'accept_pm_upload' }),
      });
      const data = await resp.json();
      if (resp.ok) {
        toast.success('Translation sent to client! Status set to FINAL.');
        await loadOrder(orderId);
        fetchOrders();
        fetchStats();
      } else {
        toast.error(data.detail || 'Failed to accept');
      }
    } catch {
      toast.error('Failed to accept upload');
    }
    setActionLoading('');
  };

  const openHtmlPreview = (html: string) => {
    const win = window.open('', '_blank', 'width=816,height=1056');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const printHtml = (html: string) => {
    const win = window.open('', '_blank', 'width=816,height=1056');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  const getTranslationHtml = (order: Order): string => {
    return order.translation_html || order.proofread_text || order.translated_text || '';
  };

  const parseAnalysis = (order: Order): Record<string, unknown> | null => {
    try {
      if (order.document_analysis) {
        return JSON.parse(order.document_analysis);
      }
    } catch { /* ignore */ }
    return null;
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="container" style={{ textAlign: 'center', padding: '4rem 0' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#3182ce' }}></i>
          <p style={{ marginTop: '1rem', color: '#718096' }}>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      {/* Header */}
      <header className="admin-header">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
                <span style={{ color: 'white' }}>TRADUX</span>
                <span style={{ color: '#ff6b35', marginLeft: '8px', fontSize: '0.9rem' }}>Admin</span>
              </h1>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowTestPanel(!showTestPanel)}
                className="btn-cert-outline-dark"
                style={{ fontSize: '0.85rem', padding: '8px 16px', background: showTestPanel ? 'rgba(255,107,53,0.3)' : 'transparent' }}
              >
                <i className="fas fa-flask"></i> Test Order
              </button>
              <button
                onClick={() => { fetchOrders(); fetchStats(); }}
                className="btn-cert-outline-dark"
                style={{ fontSize: '0.85rem', padding: '8px 16px' }}
              >
                <i className="fas fa-sync-alt"></i> Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        {/* Test Order Panel */}
        {showTestPanel && (
          <div className="admin-test-panel">
            <h3><i className="fas fa-flask"></i> Create Test Order</h3>
            <p style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '1rem' }}>
              Create a test order with sample document text to test the full translation pipeline.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label className="admin-label">Sample Document</label>
                <select
                  value={selectedSample}
                  onChange={(e) => setSelectedSample(e.target.value)}
                  className="admin-select"
                >
                  {sampleDocs.map((doc) => (
                    <option key={doc.key} value={doc.key}>
                      {doc.name} ({doc.type})
                    </option>
                  ))}
                  <option value="custom">Custom Text</option>
                </select>
              </div>
              <div>
                <label className="admin-label">Customer Name</label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  className="admin-input"
                />
              </div>
            </div>
            {selectedSample === 'custom' && (
              <div style={{ marginBottom: '1rem' }}>
                <label className="admin-label">Custom Document Text</label>
                <textarea
                  value={testCustomText}
                  onChange={(e) => setTestCustomText(e.target.value)}
                  placeholder="Paste the document text here..."
                  rows={6}
                  className="admin-textarea"
                />
              </div>
            )}
            <button
              onClick={createTestOrder}
              disabled={actionLoading === 'create-test'}
              className="btn-cert-primary"
              style={{ width: '100%' }}
            >
              {actionLoading === 'create-test'
                ? <><i className="fas fa-spinner fa-spin"></i> Creating...</>
                : <><i className="fas fa-plus"></i> Create Test Order</>}
            </button>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-num">{stats.total_orders}</div>
              <div className="admin-stat-label">Total Orders</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-num">{stats.in_progress}</div>
              <div className="admin-stat-label">In Progress</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-num">{stats.pending_pm_review}</div>
              <div className="admin-stat-label">Pending PM Review</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-num">{stats.corrections_requested}</div>
              <div className="admin-stat-label">Corrections</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-num">{stats.completed}</div>
              <div className="admin-stat-label">Completed</div>
            </div>
            <div className="admin-stat-card" style={{ background: 'linear-gradient(135deg, #38a169, #2f855a)', color: 'white' }}>
              <div className="admin-stat-num" style={{ color: 'white' }}>${stats.total_revenue.toFixed(2)}</div>
              <div className="admin-stat-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Total Revenue</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ margin: '1.5rem 0', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['', 'received', 'translating', 'pm_review', 'pm_upload_ready', 'client_review', 'corrections', 'approved', 'completed', 'final'].map((s) => (
            <button
              key={s}
              onClick={() => { setFilterStatus(s); }}
              className={`admin-filter-btn ${filterStatus === s ? 'active' : ''}`}
            >
              {s ? STATUS_LABELS[s] || s : 'All'}
            </button>
          ))}
        </div>

        <div className="admin-layout">
          {/* Orders List */}
          <div className="admin-orders-list">
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Orders ({orders.length})</h2>
            {orders.length === 0 && <p style={{ color: '#718096' }}>No orders found.</p>}
            {orders.map((order) => (
              <div
                key={order.id}
                className={`admin-order-card ${selectedOrder?.id === order.id ? 'selected' : ''}`}
                onClick={() => loadOrder(order.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong>{order.order_number} {order.is_test ? <span style={{ fontSize: '0.7rem', color: '#805ad5' }}>(TEST)</span> : ''}</strong>
                  <span
                    className="admin-status-badge"
                    style={{ background: STATUS_COLORS[order.translation_status] || '#718096' }}
                  >
                    {STATUS_LABELS[order.translation_status] || order.translation_status}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#4a5568' }}>
                  <p style={{ margin: '2px 0' }}>{order.customer_name} — {order.source_language} &rarr; {order.target_language}</p>
                  <p style={{ margin: '2px 0' }}>{order.service_tier?.charAt(0).toUpperCase() + order.service_tier?.slice(1)} | ${order.total_price?.toFixed(2)} | {order.page_count} pg</p>
                </div>
              </div>
            ))}
          </div>

          {/* Order Detail */}
          <div className="admin-order-detail">
            {!selectedOrder ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#a0aec0' }}>
                <i className="fas fa-inbox" style={{ fontSize: '3rem', marginBottom: '1rem', display: 'block' }}></i>
                <p>Select an order to view details</p>
                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Or create a test order to get started</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0 }}>
                    {selectedOrder.order_number}
                    {selectedOrder.is_test && <span style={{ fontSize: '0.75rem', color: '#805ad5', marginLeft: '8px' }}>TEST</span>}
                  </h2>
                  <span
                    className="admin-status-badge"
                    style={{
                      background: STATUS_COLORS[selectedOrder.translation_status] || '#718096',
                      fontSize: selectedOrder.translation_status === 'pm_upload_ready' || selectedOrder.translation_status === 'final' ? '0.95rem' : '0.9rem',
                      padding: '6px 16px',
                      fontWeight: selectedOrder.translation_status === 'pm_upload_ready' || selectedOrder.translation_status === 'final' ? 800 : 600,
                      letterSpacing: selectedOrder.translation_status === 'pm_upload_ready' || selectedOrder.translation_status === 'final' ? '1px' : 'normal',
                    }}
                  >
                    {STATUS_LABELS[selectedOrder.translation_status] || selectedOrder.translation_status}
                  </span>
                </div>

                {/* Order Info */}
                <div className="admin-detail-section">
                  <h3>Order Info</h3>
                  <div className="admin-info-grid">
                    <div><strong>Customer:</strong> {selectedOrder.customer_name}</div>
                    <div><strong>Email:</strong> {selectedOrder.customer_email}</div>
                    <div><strong>Languages:</strong> {selectedOrder.source_language} &rarr; {selectedOrder.target_language}</div>
                    <div><strong>Document:</strong> {selectedOrder.document_type || 'N/A'}</div>
                    <div><strong>Tier:</strong> {selectedOrder.service_tier}</div>
                    <div><strong>Cert:</strong> {selectedOrder.cert_type}</div>
                    <div><strong>Pages:</strong> {selectedOrder.page_count}</div>
                    <div><strong>Total:</strong> ${selectedOrder.total_price?.toFixed(2)}</div>
                  </div>
                </div>

                {/* Document Analysis (if available) */}
                {selectedOrder.document_analysis && (() => {
                  const analysis = parseAnalysis(selectedOrder);
                  if (!analysis) return null;
                  return (
                    <div className="admin-detail-section" style={{ background: '#f0f9ff' }}>
                      <h3><i className="fas fa-search" style={{ color: '#3182ce' }}></i> Document Analysis (Phase 1)</h3>
                      <div className="admin-info-grid" style={{ fontSize: '0.85rem' }}>
                        <div><strong>Type:</strong> {String(analysis.document_type || 'N/A')}</div>
                        <div><strong>Language:</strong> {String(analysis.source_language || 'N/A')}</div>
                        <div><strong>Country:</strong> {String(analysis.source_country || 'N/A')}</div>
                        <div><strong>Financial:</strong> {analysis.is_financial ? 'Yes' : 'No'}</div>
                        {analysis.detected_elements ? (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <strong>Elements:</strong> {Array.isArray(analysis.detected_elements) ? (analysis.detected_elements as string[]).join(', ') : String(analysis.detected_elements)}
                          </div>
                        ) : null}
                        {analysis.summary ? (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <strong>Summary:</strong> {String(analysis.summary)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })()}

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem' }}>
                  <button
                    onClick={() => setActiveTab('pipeline')}
                    style={{
                      padding: '10px 20px',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontWeight: activeTab === 'pipeline' ? 700 : 400,
                      color: activeTab === 'pipeline' ? '#1a365d' : '#718096',
                      borderBottom: activeTab === 'pipeline' ? '3px solid #3182ce' : '3px solid transparent',
                      marginBottom: '-2px',
                      fontSize: '0.9rem',
                      transition: 'all 0.2s',
                    }}
                  >
                    <i className="fas fa-robot" style={{ marginRight: '6px' }}></i> AI Pipeline
                  </button>
                  <button
                    onClick={() => setActiveTab('upload')}
                    style={{
                      padding: '10px 20px',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontWeight: activeTab === 'upload' ? 700 : 400,
                      color: activeTab === 'upload' ? '#1a365d' : '#718096',
                      borderBottom: activeTab === 'upload' ? '3px solid #ff6b35' : '3px solid transparent',
                      marginBottom: '-2px',
                      fontSize: '0.9rem',
                      transition: 'all 0.2s',
                    }}
                  >
                    <i className="fas fa-file-upload" style={{ marginRight: '6px' }}></i> Upload Translation
                  </button>
                </div>

                {/* ====== TAB 1: AI Pipeline ====== */}
                {activeTab === 'pipeline' && (
                  <>
                    {/* RECEIVED — Start Translation */}
                    {selectedOrder.translation_status === 'received' && (
                      <div className="admin-detail-section">
                        <h3><i className="fas fa-play" style={{ color: '#3182ce' }}></i> Start Translation Pipeline</h3>

                        {/* Source text preview */}
                        {selectedOrder.original_text ? (
                          <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                              Source Text ({selectedOrder.original_text.length} chars):
                            </label>
                            <pre className="admin-text-preview">
                              {selectedOrder.original_text.substring(0, 500)}
                              {selectedOrder.original_text.length > 500 ? '...' : ''}
                            </pre>
                          </div>
                        ) : (
                          <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                            <p style={{ color: '#92400e', fontSize: '0.9rem' }}>
                              <i className="fas fa-exclamation-triangle"></i> No source text found. Upload a document or the order needs documents attached.
                            </p>
                            <input
                              type="file"
                              ref={fileInputRef}
                              style={{ display: 'none' }}
                              accept=".pdf,.jpg,.jpeg,.png,.docx,.tiff"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file && selectedOrder) {
                                  uploadDocumentToOrder(selectedOrder.id, file);
                                }
                              }}
                            />
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              disabled={actionLoading === 'upload'}
                              className="btn-cert-primary"
                              style={{ marginTop: '0.5rem', fontSize: '0.85rem', padding: '8px 16px' }}
                            >
                              <i className="fas fa-upload"></i> Upload Document
                            </button>
                          </div>
                        )}

                        <textarea
                          placeholder="Optional: Add specific AI instructions (e.g., 'Use formal language', 'This is a Brazilian birth certificate from Sao Paulo')"
                          value={aiCommands}
                          onChange={(e) => setAiCommands(e.target.value)}
                          rows={3}
                          className="admin-textarea"
                          style={{ marginBottom: '1rem' }}
                        />

                        <div className="admin-pipeline-info">
                          <strong>Pipeline will run:</strong>
                          <div className="admin-pipeline-steps">
                            <span className="pipeline-step">1. Analyze</span>
                            <span className="pipeline-arrow">&rarr;</span>
                            <span className="pipeline-step">2. Glossary</span>
                            <span className="pipeline-arrow">&rarr;</span>
                            <span className="pipeline-step">3. Translate (HTML)</span>
                            <span className="pipeline-arrow">&rarr;</span>
                            <span className="pipeline-step">4. Self-Review</span>
                            <span className="pipeline-arrow">&rarr;</span>
                            <span className="pipeline-step">5. Proofread</span>
                          </div>
                        </div>

                        <button
                          onClick={() => startTranslation(selectedOrder.id)}
                          disabled={actionLoading === 'start' || !selectedOrder.original_text}
                          className="btn-cert-primary"
                          style={{ width: '100%' }}
                        >
                          {actionLoading === 'start'
                            ? <><i className="fas fa-spinner fa-spin"></i> Starting Pipeline...</>
                            : <><i className="fas fa-play"></i> Start Full Translation Pipeline</>}
                        </button>
                      </div>
                    )}

                    {/* TRANSLATING — In Progress */}
                    {selectedOrder.translation_status === 'translating' && (
                      <div className="admin-detail-section">
                        <div className="admin-progress-container">
                          <div className="admin-progress-spinner">
                            <i className="fas fa-cog fa-spin" style={{ fontSize: '2.5rem', color: '#805ad5' }}></i>
                          </div>
                          <h3 style={{ color: '#805ad5', marginBottom: '0.5rem' }}>AI Translation in Progress</h3>
                          <p style={{ color: '#718096', fontSize: '0.9rem' }}>
                            Running Phases 1-4: Document Analysis, Glossary Building, Line-by-Line Translation to HTML, Self-Review
                          </p>
                          <div className="admin-pipeline-steps" style={{ marginTop: '1rem' }}>
                            <span className="pipeline-step active">1. Analyze</span>
                            <span className="pipeline-arrow">&rarr;</span>
                            <span className="pipeline-step active">2-3. Translate</span>
                            <span className="pipeline-arrow">&rarr;</span>
                            <span className="pipeline-step">4. Self-Review</span>
                            <span className="pipeline-arrow">&rarr;</span>
                            <span className="pipeline-step">5. Proofread</span>
                          </div>
                          <p style={{ fontSize: '0.8rem', color: '#a0aec0', marginTop: '1rem' }}>
                            <i className="fas fa-sync-alt fa-spin"></i> Auto-refreshing every 5 seconds...
                          </p>
                        </div>
                      </div>
                    )}

                    {/* PROOFREADING — In Progress */}
                    {selectedOrder.translation_status === 'proofreading' && (
                      <div className="admin-detail-section">
                        <div className="admin-progress-container">
                          <div className="admin-progress-spinner">
                            <i className="fas fa-spell-check fa-pulse" style={{ fontSize: '2.5rem', color: '#d69e2e' }}></i>
                          </div>
                          <h3 style={{ color: '#d69e2e', marginBottom: '0.5rem' }}>AI Proofreading in Progress</h3>
                          <p style={{ color: '#718096', fontSize: '0.9rem' }}>
                            Phase 5: Checking accuracy, completeness, format conversions, terminology consistency...
                          </p>
                          <div className="admin-pipeline-steps" style={{ marginTop: '1rem' }}>
                            <span className="pipeline-step done">1. Analyze</span>
                            <span className="pipeline-arrow">&rarr;</span>
                            <span className="pipeline-step done">2-3. Translate</span>
                            <span className="pipeline-arrow">&rarr;</span>
                            <span className="pipeline-step done">4. Self-Review</span>
                            <span className="pipeline-arrow">&rarr;</span>
                            <span className="pipeline-step active">5. Proofread</span>
                          </div>
                          <p style={{ fontSize: '0.8rem', color: '#a0aec0', marginTop: '1rem' }}>
                            <i className="fas fa-sync-alt fa-spin"></i> Auto-refreshing every 5 seconds...
                          </p>
                        </div>
                      </div>
                    )}

                    {/* TRANSLATION ERROR */}
                    {selectedOrder.translation_status === 'translation_error' && (
                      <div className="admin-detail-section" style={{ background: '#fff5f5', borderColor: '#fed7d7' }}>
                        <h3 style={{ color: '#c53030' }}><i className="fas fa-exclamation-triangle"></i> Translation Error</h3>
                        <p style={{ color: '#742a2a', fontSize: '0.9rem', marginBottom: '1rem' }}>
                          {(selectedOrder as unknown as Record<string, string>).error_message || 'An error occurred during translation.'}
                        </p>
                        <textarea
                          placeholder="Optional: Add or adjust AI instructions for retry"
                          value={aiCommands}
                          onChange={(e) => setAiCommands(e.target.value)}
                          rows={2}
                          className="admin-textarea"
                          style={{ marginBottom: '0.5rem' }}
                        />
                        <button
                          onClick={() => reTranslate(selectedOrder.id)}
                          disabled={actionLoading === 're-translate'}
                          className="btn-cert-primary"
                          style={{ width: '100%' }}
                        >
                          {actionLoading === 're-translate'
                            ? <><i className="fas fa-spinner fa-spin"></i> Retrying...</>
                            : <><i className="fas fa-redo"></i> Retry Translation</>}
                        </button>
                      </div>
                    )}

                    {/* PM REVIEW / CORRECTIONS — Review + Edit HTML */}
                    {(selectedOrder.translation_status === 'pm_review' || selectedOrder.translation_status === 'corrections') && (
                      <div className="admin-detail-section">
                        <h3><i className="fas fa-eye" style={{ color: '#dd6b20' }}></i> Translation Review (PM)</h3>

                        {/* Client corrections notice */}
                        {selectedOrder.translation_status === 'corrections' && selectedOrder.correction_notes && (
                          <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                            <strong style={{ color: '#e53e3e' }}><i className="fas fa-exclamation-triangle"></i> Client Corrections Requested:</strong>
                            <p style={{ margin: '0.5rem 0 0', color: '#742a2a' }}>{selectedOrder.correction_notes}</p>
                          </div>
                        )}

                        {/* AI corrections */}
                        {selectedOrder.ai_corrections && (
                          <div style={{ background: '#fffff0', border: '1px solid #fefcbf', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                            <strong style={{ color: '#975a16' }}><i className="fas fa-robot"></i> AI Proofreading Corrections:</strong>
                            <p style={{ margin: '0.5rem 0 0', color: '#744210', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{selectedOrder.ai_corrections}</p>
                          </div>
                        )}

                        {/* HTML Preview / Edit Toggle */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => { setShowHtmlPreview(!showHtmlPreview); setEditingHtml(false); }}
                            className={`admin-tab-btn ${showHtmlPreview && !editingHtml ? 'active' : ''}`}
                          >
                            <i className="fas fa-eye"></i> Preview HTML
                          </button>
                          <button
                            onClick={() => {
                              setEditingHtml(!editingHtml);
                              setShowHtmlPreview(false);
                              if (!editingHtml) {
                                setEditHtmlContent(getTranslationHtml(selectedOrder));
                              }
                            }}
                            className={`admin-tab-btn ${editingHtml ? 'active' : ''}`}
                          >
                            <i className="fas fa-code"></i> Edit HTML
                          </button>
                          <button
                            onClick={() => openHtmlPreview(getTranslationHtml(selectedOrder))}
                            className="admin-tab-btn"
                          >
                            <i className="fas fa-external-link-alt"></i> Open in New Tab
                          </button>
                          <button
                            onClick={() => printHtml(getTranslationHtml(selectedOrder))}
                            className="admin-tab-btn"
                          >
                            <i className="fas fa-print"></i> Print / PDF
                          </button>
                        </div>

                        {/* HTML Preview (iframe) */}
                        {showHtmlPreview && !editingHtml && (
                          <div className="admin-html-preview-container">
                            <iframe
                              srcDoc={getTranslationHtml(selectedOrder)}
                              title="Translation Preview"
                              className="admin-html-iframe"
                            />
                          </div>
                        )}

                        {/* HTML Editor */}
                        {editingHtml && (
                          <div style={{ marginBottom: '1rem' }}>
                            <textarea
                              value={editHtmlContent}
                              onChange={(e) => setEditHtmlContent(e.target.value)}
                              rows={20}
                              className="admin-code-editor"
                            />
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                              <button
                                onClick={() => saveHtmlEdit(selectedOrder.id)}
                                disabled={actionLoading === 'save-html'}
                                className="btn-cert-primary"
                                style={{ flex: 1 }}
                              >
                                {actionLoading === 'save-html'
                                  ? <><i className="fas fa-spinner fa-spin"></i> Saving...</>
                                  : <><i className="fas fa-save"></i> Save Changes</>}
                              </button>
                              <button
                                onClick={() => { setEditingHtml(false); }}
                                className="admin-tab-btn"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Original text (collapsible) */}
                        {!showHtmlPreview && !editingHtml && (
                          <>
                            <details style={{ marginBottom: '1rem' }}>
                              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: '#4a5568' }}>
                                <i className="fas fa-file-alt"></i> Original Text
                              </summary>
                              <pre className="admin-text-preview" style={{ marginTop: '0.5rem' }}>
                                {selectedOrder.original_text || 'No text extracted'}
                              </pre>
                            </details>
                            <details open style={{ marginBottom: '1rem' }}>
                              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: '#2f855a' }}>
                                <i className="fas fa-language"></i> Translation (HTML)
                              </summary>
                              <pre className="admin-text-preview" style={{ marginTop: '0.5rem', background: '#f0fff4', border: '1px solid #c6f6d5', maxHeight: '400px' }}>
                                {getTranslationHtml(selectedOrder).substring(0, 3000) || 'Translation not available'}
                                {getTranslationHtml(selectedOrder).length > 3000 ? '\n\n... [truncated — use Preview or Edit to see full HTML]' : ''}
                              </pre>
                            </details>
                          </>
                        )}

                        {/* Re-translate option */}
                        <details style={{ marginBottom: '1rem' }}>
                          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: '#805ad5' }}>
                            <i className="fas fa-redo"></i> Re-translate with different instructions
                          </summary>
                          <div style={{ marginTop: '0.5rem' }}>
                            <textarea
                              placeholder="Add specific AI instructions for the re-translation..."
                              value={aiCommands}
                              onChange={(e) => setAiCommands(e.target.value)}
                              rows={2}
                              className="admin-textarea"
                              style={{ marginBottom: '0.5rem' }}
                            />
                            <button
                              onClick={() => reTranslate(selectedOrder.id)}
                              disabled={actionLoading === 're-translate'}
                              className="btn-cert-primary"
                              style={{ width: '100%', background: 'linear-gradient(135deg, #805ad5, #6b46c1)' }}
                            >
                              {actionLoading === 're-translate'
                                ? <><i className="fas fa-spinner fa-spin"></i> Re-translating...</>
                                : <><i className="fas fa-redo"></i> Re-translate</>}
                            </button>
                          </div>
                        </details>

                        {/* Approve button */}
                        <button
                          onClick={() => approvePM(selectedOrder.id)}
                          disabled={actionLoading === 'approve'}
                          className="btn-cert-primary"
                          style={{ width: '100%' }}
                        >
                          {actionLoading === 'approve'
                            ? <><i className="fas fa-spinner fa-spin"></i> Sending to Client...</>
                            : <><i className="fas fa-paper-plane"></i> Approve &amp; Send to Client for Review</>}
                        </button>
                      </div>
                    )}

                    {/* CLIENT REVIEW — Waiting */}
                    {selectedOrder.translation_status === 'client_review' && (
                      <div className="admin-detail-section">
                        <div className="admin-progress-container">
                          <i className="fas fa-user-clock" style={{ fontSize: '2.5rem', color: '#38a169', marginBottom: '1rem', display: 'block' }}></i>
                          <h3 style={{ color: '#38a169', marginBottom: '0.5rem' }}>Waiting for Client Review</h3>
                          <p style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '1rem' }}>
                            The client ({selectedOrder.customer_email}) has received the translation and is reviewing it.
                          </p>
                        </div>
                        {/* Preview buttons */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <button onClick={() => openHtmlPreview(getTranslationHtml(selectedOrder))} className="admin-tab-btn" style={{ flex: 1 }}>
                            <i className="fas fa-eye"></i> Preview Translation
                          </button>
                          <button onClick={() => printHtml(getTranslationHtml(selectedOrder))} className="admin-tab-btn" style={{ flex: 1 }}>
                            <i className="fas fa-print"></i> Print / PDF
                          </button>
                        </div>
                      </div>
                    )}

                    {/* APPROVED — Finalize */}
                    {selectedOrder.translation_status === 'approved' && (
                      <div className="admin-detail-section">
                        <div style={{ textAlign: 'center', padding: '1rem', marginBottom: '1rem' }}>
                          <i className="fas fa-check-circle" style={{ fontSize: '2.5rem', color: '#38a169', display: 'block', marginBottom: '0.5rem' }}></i>
                          <h3 style={{ color: '#38a169' }}>Client Approved the Translation!</h3>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                          <button onClick={() => openHtmlPreview(getTranslationHtml(selectedOrder))} className="admin-tab-btn" style={{ flex: 1 }}>
                            <i className="fas fa-eye"></i> Preview
                          </button>
                          <button onClick={() => printHtml(getTranslationHtml(selectedOrder))} className="admin-tab-btn" style={{ flex: 1 }}>
                            <i className="fas fa-print"></i> Print / PDF
                          </button>
                        </div>
                        <button
                          onClick={() => markComplete(selectedOrder.id)}
                          disabled={actionLoading === 'complete'}
                          className="btn-cert-primary"
                          style={{ width: '100%', background: 'linear-gradient(135deg, #38a169, #2f855a)' }}
                        >
                          {actionLoading === 'complete'
                            ? <><i className="fas fa-spinner fa-spin"></i> Completing...</>
                            : <><i className="fas fa-check-double"></i> Finalize &amp; Deliver</>}
                        </button>
                      </div>
                    )}

                    {/* COMPLETED */}
                    {selectedOrder.translation_status === 'completed' && (
                      <div className="admin-detail-section">
                        <div style={{ textAlign: 'center', padding: '1.5rem' }}>
                          <i className="fas fa-trophy" style={{ fontSize: '2.5rem', color: '#d69e2e', marginBottom: '1rem', display: 'block' }}></i>
                          <h3 style={{ color: '#276749' }}>Order Completed</h3>
                        </div>
                        {getTranslationHtml(selectedOrder) && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => openHtmlPreview(getTranslationHtml(selectedOrder))} className="admin-tab-btn" style={{ flex: 1 }}>
                              <i className="fas fa-eye"></i> View Translation
                            </button>
                            <button onClick={() => printHtml(getTranslationHtml(selectedOrder))} className="admin-tab-btn" style={{ flex: 1 }}>
                              <i className="fas fa-print"></i> Print / PDF
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* PM UPLOAD READY — hint to switch tab */}
                    {selectedOrder.translation_status === 'pm_upload_ready' && (
                      <div className="admin-detail-section">
                        <div style={{ textAlign: 'center', padding: '1.5rem' }}>
                          <i className="fas fa-file-alt" style={{ fontSize: '2rem', color: '#10b981', marginBottom: '1rem', display: 'block' }}></i>
                          <p style={{ color: '#10b981', fontWeight: 700, fontSize: '1.1rem' }}>READY — PM uploaded an external translation</p>
                          <p style={{ fontSize: '0.85rem', color: '#718096', marginTop: '0.5rem' }}>Switch to the "Upload Translation" tab to review and accept.</p>
                        </div>
                      </div>
                    )}

                    {/* FINAL */}
                    {selectedOrder.translation_status === 'final' && (
                      <div className="admin-detail-section">
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                          <i className="fas fa-flag-checkered" style={{ fontSize: '2rem', color: '#065f46', marginBottom: '1rem', display: 'block' }}></i>
                          <p style={{ color: '#065f46', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '2px' }}>FINAL</p>
                          <p style={{ fontSize: '0.85rem', color: '#718096', marginTop: '0.5rem' }}>Translation delivered to client via uploaded file.</p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ====== TAB 2: Upload Translation ====== */}
                {activeTab === 'upload' && (
                  <>
                    {/* Show uploaded file info if already uploaded */}
                    {selectedOrder.pm_upload_filename && (
                      <div className="admin-detail-section" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.75rem' }}>
                          <i className="fas fa-file-alt" style={{ fontSize: '1.5rem', color: '#10b981' }}></i>
                          <div>
                            <p style={{ margin: 0, fontWeight: 600, color: '#065f46' }}>Uploaded Translation</p>
                            <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#4b5563' }}>
                              {selectedOrder.pm_upload_filename}
                              {selectedOrder.pm_upload_file_size && (
                                <span style={{ marginLeft: '8px', color: '#9ca3af' }}>
                                  ({(selectedOrder.pm_upload_file_size / 1024).toFixed(1)} KB)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <a
                          href={`${API_URL}/admin/orders/${selectedOrder.id}/pm-translation-download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#1a365d',
                            color: 'white',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            textDecoration: 'none',
                            fontWeight: 600,
                          }}
                        >
                          <i className="fas fa-eye"></i> Open & Review File
                        </a>
                      </div>
                    )}

                    {/* READY status — Admin accept & send */}
                    {selectedOrder.translation_status === 'pm_upload_ready' && (
                      <div className="admin-detail-section">
                        <div style={{ textAlign: 'center', padding: '1rem', marginBottom: '1rem' }}>
                          <div style={{
                            display: 'inline-block',
                            padding: '8px 24px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: 'white',
                            borderRadius: '30px',
                            fontWeight: 800,
                            fontSize: '1.1rem',
                            letterSpacing: '2px',
                            marginBottom: '1rem',
                          }}>
                            READY
                          </div>
                          <p style={{ color: '#374151', fontSize: '0.95rem' }}>
                            The PM has uploaded the final translation. Review and accept to send to the client.
                          </p>
                        </div>
                        <button
                          onClick={() => acceptPmUpload(selectedOrder.id)}
                          disabled={actionLoading === 'accept_upload'}
                          className="btn-cert-primary"
                          style={{ width: '100%', background: 'linear-gradient(135deg, #065f46, #10b981)' }}
                        >
                          {actionLoading === 'accept_upload'
                            ? <><i className="fas fa-spinner fa-spin"></i> Sending to client...</>
                            : <><i className="fas fa-paper-plane"></i> Accept & Send to Client</>
                          }
                        </button>
                      </div>
                    )}

                    {/* FINAL status */}
                    {selectedOrder.translation_status === 'final' && (
                      <div className="admin-detail-section">
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                          <i className="fas fa-flag-checkered" style={{ fontSize: '2rem', color: '#065f46', marginBottom: '1rem', display: 'block' }}></i>
                          <p style={{ color: '#065f46', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '2px' }}>FINAL</p>
                          <p style={{ fontSize: '0.85rem', color: '#718096', marginTop: '0.5rem' }}>Translation has been sent to the client.</p>
                        </div>
                      </div>
                    )}

                    {/* Upload area (show when NOT already READY or FINAL) */}
                    {selectedOrder.translation_status !== 'pm_upload_ready' && selectedOrder.translation_status !== 'final' && (
                      <div className="admin-detail-section">
                        <h3><i className="fas fa-file-upload" style={{ marginRight: '6px', color: '#ff6b35' }}></i> Upload Final Translation</h3>
                        <p style={{ fontSize: '0.9rem', color: '#718096', marginBottom: '1rem' }}>
                          Upload the final external translation file. This will set the order status to <strong style={{ color: '#10b981' }}>READY</strong> for admin review.
                        </p>

                        <div
                          style={{
                            border: '2px dashed #cbd5e0',
                            borderRadius: '12px',
                            padding: '2rem',
                            textAlign: 'center',
                            background: uploadFile ? '#f0fdf4' : '#f9fafb',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            marginBottom: '1rem',
                          }}
                          onClick={() => document.getElementById('pm-upload-input')?.click()}
                        >
                          <input
                            id="pm-upload-input"
                            type="file"
                            accept=".pdf,.doc,.docx,.txt,.xlsx,.pptx,.jpg,.jpeg,.png"
                            style={{ display: 'none' }}
                            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                          />
                          {uploadFile ? (
                            <>
                              <i className="fas fa-file-check" style={{ fontSize: '2rem', color: '#10b981', marginBottom: '0.5rem', display: 'block' }}></i>
                              <p style={{ fontWeight: 600, color: '#065f46', margin: '0.5rem 0 0' }}>{uploadFile.name}</p>
                              <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>({(uploadFile.size / 1024).toFixed(1)} KB) — Click to change file</p>
                            </>
                          ) : (
                            <>
                              <i className="fas fa-cloud-upload-alt" style={{ fontSize: '2rem', color: '#a0aec0', marginBottom: '0.5rem', display: 'block' }}></i>
                              <p style={{ fontWeight: 600, color: '#4a5568', margin: '0.5rem 0 0' }}>Click to select the translation file</p>
                              <p style={{ fontSize: '0.8rem', color: '#a0aec0' }}>PDF, DOCX, TXT, XLSX, images (max 20MB)</p>
                            </>
                          )}
                        </div>

                        <button
                          onClick={() => uploadPmTranslation(selectedOrder.id)}
                          disabled={!uploadFile || uploadLoading}
                          className="btn-cert-primary"
                          style={{
                            width: '100%',
                            background: uploadFile ? 'linear-gradient(135deg, #ff6b35, #ff8c42)' : '#cbd5e0',
                            cursor: uploadFile ? 'pointer' : 'not-allowed',
                          }}
                        >
                          {uploadLoading
                            ? <><i className="fas fa-spinner fa-spin"></i> Uploading...</>
                            : <><i className="fas fa-paper-plane"></i> Upload & Send to Admin</>
                          }
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
