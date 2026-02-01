import { Link } from 'wouter';

export default function Cancel() {
  return (
    <div className="result-page">
      <div className="result-card">
        <div className="result-icon cancel-icon">
          <i className="fas fa-times"></i>
        </div>
        <h1>Payment Canceled</h1>
        <p>Your payment was not completed. Don't worry — your quote has been saved and you can complete the payment at any time.</p>
        <div className="result-info">
          <h3><i className="fas fa-question-circle"></i> Need Help?</h3>
          <p><i className="fas fa-envelope"></i> Email: contact@tradux.online</p>
          <p><i className="fas fa-phone"></i> Phone: +1 (689) 309-4980</p>
          <p><i className="fas fa-clock"></i> We're available 24/7</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/#order" className="btn-cert-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <i className="fas fa-redo"></i> Try Again
          </Link>
          <Link href="/" className="btn-cert-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <i className="fas fa-home"></i> Home
          </Link>
        </div>
      </div>
    </div>
  );
}
