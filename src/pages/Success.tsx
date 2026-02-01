import { Link } from 'wouter';

export default function Success() {
  return (
    <div className="result-page">
      <div className="result-card">
        <div className="result-icon success-icon">
          <i className="fas fa-check"></i>
        </div>
        <h1>Payment Successful!</h1>
        <p>Thank you for your order. Your translation request has been received and our team will start working on it immediately.</p>
        <div className="result-info">
          <h3><i className="fas fa-info-circle"></i> What's Next?</h3>
          <p><i className="fas fa-envelope"></i> You will receive a confirmation email shortly</p>
          <p><i className="fas fa-language"></i> Your document will be translated by AI and reviewed by a human PM</p>
          <p><i className="fas fa-file-alt"></i> You'll receive a link to review and approve your translation</p>
          <p><i className="fas fa-certificate"></i> Once approved, you'll get the final certified document</p>
        </div>
        <Link href="/" className="btn-cert-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <i className="fas fa-home"></i> Return to Home
        </Link>
      </div>
    </div>
  );
}
