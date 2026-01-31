import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="not-found">
      <div className="not-found-content">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <Link href="/" className="btn-white" style={{ background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)', color: 'white', textDecoration: 'none' }}>
          <i className="fas fa-home"></i>
          Back to Home
        </Link>
      </div>
    </div>
  );
}
