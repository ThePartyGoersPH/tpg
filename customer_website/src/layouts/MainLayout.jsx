import { Outlet } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { useAuth } from '../hooks/useAuth';

function MainLayout() {
  const { maintenance } = useAuth();

  return (
    <>
      <Navbar />
      {maintenance.active && (
        <div className="maintenance-banner">
          <div className="container">
            <span className="maintenance-icon">🔧</span>
            <span>{maintenance.message}</span>
          </div>
        </div>
      )}
      <main className="page">
        <div className="container">
          {maintenance.active ? (
            <div className="maintenance-overlay">
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ fontSize: '4rem', marginBottom: '1rem' }}>🛠️</p>
                <h2>Platform Under Maintenance</h2>
                <p className="text-muted" style={{ marginTop: '0.5rem' }}>
                  {maintenance.message}
                </p>
                <p className="text-muted" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
                  Menu ordering, reservations, and payments are temporarily unavailable.
                </p>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

export default MainLayout;
