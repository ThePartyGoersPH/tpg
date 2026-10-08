import { Link, useLocation } from 'react-router-dom';
import { CUSTOMER_ROLE_BLOCK_MESSAGE } from '../utils/constants';

function UnauthorizedPage() {
  const location = useLocation();
  const message = location.state?.message || CUSTOMER_ROLE_BLOCK_MESSAGE;

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1 className="section-title">Access Denied</h1>
        <p>{message}</p>
        <Link className="button" to="/login">Back to Login</Link>
      </div>
    </div>
  );
}

export default UnauthorizedPage;
