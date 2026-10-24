import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1 className="section-title">404</h1>
        <p>Page not found.</p>
        <Link className="button" to="/">Go Home</Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
