import React, { useEffect, useRef } from 'react';

const WhatIsIt = () => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('lp-visible'); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="relative py-28 bg-[#0A0A0A] overflow-hidden">
      {/* Red glow blob */}
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(204,0,0,0.08) 0%, transparent 70%)', left: '-100px' }}
      />

      <div ref={ref} className="lp-reveal max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: text */}
          <div>
            <p className="text-xs font-body font-bold uppercase tracking-[0.25em] mb-4" style={{ color: '#CC0000' }}>
              THE PLATFORM
            </p>
            <h2
              className="font-display text-white mb-6 leading-none"
              style={{ fontSize: 'clamp(48px, 6vw, 80px)', letterSpacing: '0.02em' }}
            >
              EVERYTHING YOUR BAR NEEDS.{' '}
              <span style={{ color: '#CC0000' }}>ONE DASHBOARD.</span>
            </h2>
            <p className="font-body text-gray-400 text-lg leading-relaxed mb-8">
              Platform Bar System is a complete bar operations management suite built exclusively for Philippine bar owners. Manage your staff, run payroll, track reservations, control your menu, host events, and watch your analytics — all from a single, powerful dashboard.
            </p>
            <div className="space-y-4">
              {[
                'Multi-branch management under one account',
                'Role-based access control for every staff member',
                'Real-time analytics and financial reporting',
                'Integrated payroll with automatic deductions',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center" style={{ background: 'rgba(204,0,0,0.15)', border: '1px solid rgba(204,0,0,0.4)' }}>
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="#CC0000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="font-body text-gray-300 text-sm leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: visual mockup */}
          <div className="relative">
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{ background: 'radial-gradient(circle at 50% 50%, rgba(204,0,0,0.1) 0%, transparent 70%)' }}
            />
            <div
              className="rounded-2xl overflow-hidden relative"
              style={{
                background: '#111111',
                border: '1px solid rgba(204,0,0,0.15)',
                boxShadow: '0 0 60px rgba(204,0,0,0.08), 0 30px 60px rgba(0,0,0,0.5)',
              }}
            >
              {/* Header bar */}
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded" style={{ background: '#CC0000' }} />
                  <span className="font-display text-white text-sm tracking-wider">PLATFORM BAR SYSTEM</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-[10px] text-green-400 font-body">Live</span>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Metrics row */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Tonight\'s Revenue', val: '₱42,800', sub: '+18% vs last week', color: '#22c55e' },
                    { label: 'Tables Occupied', val: '14 / 20', sub: '70% capacity', color: '#CC0000' },
                    { label: 'Active Staff', val: '12', sub: '3 on break', color: '#f59e0b' },
                    { label: 'Pending Reservations', val: '8', sub: 'Next 2 hours', color: '#3b82f6' },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-xl p-3"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <p className="text-[10px] text-gray-500 font-body mb-1.5">{m.label}</p>
                      <p className="font-display text-white text-xl">{m.val}</p>
                      <p className="text-[10px] font-body mt-1" style={{ color: m.color }}>{m.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Activity feed */}
                <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px] text-gray-500 font-body mb-2 uppercase tracking-wider">Live Activity</p>
                  <div className="space-y-2">
                    {[
                      { txt: 'New reservation — Table 6, 9PM', time: '2m ago', dot: '#CC0000' },
                      { txt: 'Payroll run finalized — ₱184,000', time: '1h ago', dot: '#22c55e' },
                      { txt: 'Staff check-in — Juan D.', time: '3h ago', dot: '#3b82f6' },
                    ].map((a) => (
                      <div key={a.txt} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: a.dot }} />
                          <span className="text-[11px] text-gray-300 font-body">{a.txt}</span>
                        </div>
                        <span className="text-[10px] text-gray-600 font-body flex-shrink-0 ml-2">{a.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhatIsIt;
