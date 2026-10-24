import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  return (
    <div className={`sa-app-layout flex h-screen${mobileNavOpen ? ' mobile-nav-open' : ''}`}>
      <Sidebar mobileNavOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      {mobileNavOpen && <button type="button" className="sa-mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      
      <div className="sa-app-content flex-1 flex flex-col ml-64">
        <Navbar mobileNavOpen={mobileNavOpen} onMobileNavToggle={() => setMobileNavOpen((open) => !open)} />
        
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
