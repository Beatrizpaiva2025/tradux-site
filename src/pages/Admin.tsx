import { useState, useEffect, useCallback } from 'react';
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
  proofread_text: string;
  ai_corrections: string;
  pm_approved: boolean;
  client_approved: boolean;
  correction_notes: string;
  created_at: string;
  document_ids: string[];
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
  ocr_processing: 'OCR Processing',
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

  useEffect(() => {
    Promise.all([fetchOrders(), fetchStats()]).finally(() => setLoading(false));
  }, [fetchOrders, fetchStats]);

  const loadOrder = async (orderId: string) => {
    try {
      const resp = await fetch(`${API_URL}/admin/orders/${orderId}`);
      setSelectedOrder(await resp.json());
    } catch {
      toast.error('Failed to load order');
    }
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
        toast.success('Translation pipeline started!');
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
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
                <span style={{ color: 'white' }}>TRADUX</span>
                <span style={{ color: '#ff6b35', marginLeft: '8px', fontSize: '0.9rem' }}>Admin</span>
              </h1>
            </div>
            <button onClick={() => { fetchOrders(); fetchStats(); }} className="btn-cert-outline-dark" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
              <i className="fas fa-sync-alt"></i> Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
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
          {['', 'received', 'translating', 'pm_review', 'pm_upload_ready', 'client_review', 'corrections', 'completed', 'final'].map((s) => (
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
                  <strong>{order.order_number}</strong>
                  <span
                    className="admin-status-badge"
                    style={{ background: STATUS_COLORS[order.translation_status] || '#718096' }}
                  >
                    {STATUS_LABELS[order.translation_status] || order.translation_status}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#4a5568' }}>
                  <p style={{ margin: '2px 0' }}>{order.customer_name} — {order.source_language} → {order.target_language}</p>
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
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0 }}>{selectedOrder.order_number}</h2>
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
                    <div><strong>Languages:</strong> {selectedOrder.source_language} → {selectedOrder.target_language}</div>
                    <div><strong>Document:</strong> {selectedOrder.document_type || 'N/A'}</div>
                    <div><strong>Tier:</strong> {selectedOrder.service_tier}</div>
                    <div><strong>Cert:</strong> {selectedOrder.cert_type}</div>
                    <div><strong>Pages:</strong> {selectedOrder.page_count}</div>
                    <div><strong>Total:</strong> ${selectedOrder.total_price?.toFixed(2)}</div>
                  </div>
                </div>

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

                {/* ====== TAB 1: AI Pipeline (existing — untouched) ====== */}
                {activeTab === 'pipeline' && (
                  <>
                    {selectedOrder.translation_status === 'received' && (
                      <div className="admin-detail-section">
                        <h3>Start Translation</h3>
                        <p style={{ fontSize: '0.9rem', color: '#718096', marginBottom: '1rem' }}>
                          Click the button below to start the AI translation pipeline. The system will translate the document and proofread it automatically.
                        </p>
                        <textarea
                          placeholder="Optional: Add specific AI instructions (e.g., 'Use formal language', 'Preserve legal terminology')"
                          value={aiCommands}
                          onChange={(e) => setAiCommands(e.target.value)}
                          rows={3}
                          style={{ width: '100%', marginBottom: '1rem', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                        />
                        <button
                          onClick={() => startTranslation(selectedOrder.id)}
                          disabled={actionLoading === 'start'}
                          className="btn-cert-primary"
                          style={{ width: '100%' }}
                        >
                          {actionLoading === 'start' ? <><i className="fas fa-spinner fa-spin"></i> Starting...</> : <><i className="fas fa-play"></i> Start AI Translation</>}
                        </button>
                      </div>
                    )}

                    {selectedOrder.translation_status === 'translating' && (
                      <div className="admin-detail-section">
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                          <i className="fas fa-cog fa-spin" style={{ fontSize: '2rem', color: '#805ad5', marginBottom: '1rem', display: 'block' }}></i>
                          <p style={{ color: '#805ad5', fontWeight: 600 }}>AI is translating the document...</p>
                          <p style={{ fontSize: '0.85rem', color: '#718096' }}>This may take a few moments. Refresh to check status.</p>
                        </div>
                      </div>
                    )}

                    {selectedOrder.translation_status === 'proofreading' && (
                      <div className="admin-detail-section">
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                          <i className="fas fa-spell-check fa-pulse" style={{ fontSize: '2rem', color: '#d69e2e', marginBottom: '1rem', display: 'block' }}></i>
                          <p style={{ color: '#d69e2e', fontWeight: 600 }}>AI is proofreading the translation...</p>
                        </div>
                      </div>
                    )}

                    {(selectedOrder.translation_status === 'pm_review' || selectedOrder.translation_status === 'corrections') && (
                      <div className="admin-detail-section">
                        <h3>Translation Review (PM)</h3>

                        {selectedOrder.translation_status === 'corrections' && selectedOrder.correction_notes && (
                          <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                            <strong style={{ color: '#e53e3e' }}><i className="fas fa-exclamation-triangle"></i> Client Corrections:</strong>
                            <p style={{ margin: '0.5rem 0 0', color: '#742a2a' }}>{selectedOrder.correction_notes}</p>
                          </div>
                        )}

                        {selectedOrder.ai_corrections && (
                          <div style={{ background: '#fffff0', border: '1px solid #fefcbf', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                            <strong style={{ color: '#975a16' }}><i className="fas fa-robot"></i> AI Corrections:</strong>
                            <p style={{ margin: '0.5rem 0 0', color: '#744210', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{selectedOrder.ai_corrections}</p>
                          </div>
                        )}

                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Original Text:</label>
                          <pre style={{ background: '#f7fafc', padding: '1rem', borderRadius: '8px', maxHeight: '200px', overflow: 'auto', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                            {selectedOrder.original_text || 'No text extracted'}
                          </pre>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Proofread Translation:</label>
                          <pre style={{ background: '#f0fff4', padding: '1rem', borderRadius: '8px', maxHeight: '300px', overflow: 'auto', fontSize: '0.85rem', whiteSpace: 'pre-wrap', border: '1px solid #c6f6d5' }}>
                            {selectedOrder.proofread_text || selectedOrder.translated_text || 'Translation not available'}
                          </pre>
                        </div>

                        <button
                          onClick={() => approvePM(selectedOrder.id)}
                          disabled={actionLoading === 'approve'}
                          className="btn-cert-primary"
                          style={{ width: '100%' }}
                        >
                          {actionLoading === 'approve' ? <><i className="fas fa-spinner fa-spin"></i> Sending...</> : <><i className="fas fa-paper-plane"></i> Approve & Send to Client</>}
                        </button>
                      </div>
                    )}

                    {selectedOrder.translation_status === 'client_review' && (
                      <div className="admin-detail-section">
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                          <i className="fas fa-user-clock" style={{ fontSize: '2rem', color: '#38a169', marginBottom: '1rem', display: 'block' }}></i>
                          <p style={{ color: '#38a169', fontWeight: 600 }}>Waiting for client review...</p>
                          <p style={{ fontSize: '0.85rem', color: '#718096' }}>The client has received the translation and is reviewing it.</p>
                        </div>
                      </div>
                    )}

                    {selectedOrder.translation_status === 'approved' && (
                      <div className="admin-detail-section">
                        <div style={{ textAlign: 'center', padding: '1rem', marginBottom: '1rem' }}>
                          <i className="fas fa-check-circle" style={{ fontSize: '2rem', color: '#38a169', display: 'block', marginBottom: '0.5rem' }}></i>
                          <p style={{ color: '#38a169', fontWeight: 600 }}>Client approved the translation!</p>
                        </div>
                        <button
                          onClick={() => markComplete(selectedOrder.id)}
                          disabled={actionLoading === 'complete'}
                          className="btn-cert-primary"
                          style={{ width: '100%', background: 'linear-gradient(135deg, #38a169, #2f855a)' }}
                        >
                          {actionLoading === 'complete' ? <><i className="fas fa-spinner fa-spin"></i> Completing...</> : <><i className="fas fa-check-double"></i> Finalize & Deliver</>}
                        </button>
                      </div>
                    )}

                    {selectedOrder.translation_status === 'completed' && (
                      <div className="admin-detail-section">
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                          <i className="fas fa-trophy" style={{ fontSize: '2rem', color: '#d69e2e', marginBottom: '1rem', display: 'block' }}></i>
                          <p style={{ color: '#276749', fontWeight: 600 }}>Order Completed</p>
                        </div>
                      </div>
                    )}

                    {selectedOrder.translation_status === 'pm_upload_ready' && (
                      <div className="admin-detail-section">
                        <div style={{ textAlign: 'center', padding: '1.5rem' }}>
                          <i className="fas fa-file-alt" style={{ fontSize: '2rem', color: '#10b981', marginBottom: '1rem', display: 'block' }}></i>
                          <p style={{ color: '#10b981', fontWeight: 700, fontSize: '1.1rem' }}>READY — PM uploaded an external translation</p>
                          <p style={{ fontSize: '0.85rem', color: '#718096', marginTop: '0.5rem' }}>Switch to the "Upload Translation" tab to review and accept.</p>
                        </div>
                      </div>
                    )}

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

                {/* ====== TAB 2: Upload Translation (NEW) ====== */}
                {activeTab === 'upload' && (
                  <>
                    {/* Show uploaded file info if already uploaded */}
                    {selectedOrder.pm_upload_filename && (
                      <div className="admin-detail-section" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
