import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout() {
  // The drawer also closes on navigation via Sidebar's nav onClick handler.
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex-1 flex flex-col ml-0 lg:ml-64 min-w-0">
        <Navbar onMenu={() => setMobileOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
