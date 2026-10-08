import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const Hero = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let time = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const orbs = [
      { x: 0.2, y: 0.3, r: 0.35, speed: 0.0004 },
      { x: 0.8, y: 0.6, r: 0.3, speed: 0.0003 },
      { x: 0.5, y: 0.9, r: 0.25, speed: 0.0005 },
    ];

    const draw = () => {
      time += 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      orbs.forEach((orb) => {
        const px = (orb.x + Math.sin(time * orb.speed * 2) * 0.12) * canvas.width;
        const py = (orb.y + Math.cos(time * orb.speed) * 0.1) * canvas.height;
        const radius = orb.r * Math.min(canvas.width, canvas.height);

        const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
        grad.addColorStop(0, 'rgba(204,0,0,0.22)');
        grad.addColorStop(0.5, 'rgba(180,0,0,0.08)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#0A0A0A]">
      {/* Animated canvas background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Noise grain overlay */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '150px',
        }}
      />

      {/* Grid lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 py-24 w-full">
        <div className="max-w-4xl">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-red-600/30 bg-red-600/10 mb-8 hero-fade-in" style={{ animationDelay: '0ms' }}>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-xs font-semibold uppercase tracking-widest font-body">Now Live — Bar Operations Platform</span>
          </div>

          {/* Main headline */}
          <h1
            className="font-display text-white leading-none mb-6 hero-fade-in"
            style={{
              fontSize: 'clamp(72px, 10vw, 140px)',
              lineHeight: 0.95,
              letterSpacing: '0.02em',
              animationDelay: '100ms',
            }}
          >
            RUN YOUR BAR.<br />
            <span style={{ color: '#CC0000' }}>OWN YOUR</span><br />
            NUMBERS.
          </h1>

          {/* Subheadline */}
          <p
            className="text-gray-400 font-body text-lg md:text-xl mb-10 max-w-xl leading-relaxed hero-fade-in"
            style={{ animationDelay: '200ms' }}
          >
            The all-in-one platform built for Cavite bar owners who are serious about operations, staff, and growth.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4 hero-fade-in" style={{ animationDelay: '300ms' }}>
            <Link
              to="/login"
              className="relative group px-8 py-4 rounded-lg font-body font-semibold text-white text-base overflow-hidden transition-all duration-300"
              style={{ background: '#CC0000', boxShadow: '0 0 30px rgba(204,0,0,0.4), 0 0 60px rgba(204,0,0,0.15)' }}
            >
              <span className="relative z-10">Register Your Bar</span>
              <span
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: 'linear-gradient(135deg, #FF1A1A 0%, #CC0000 100%)' }}
              />
              <span className="absolute inset-0 rounded-lg glow-pulse-red pointer-events-none" />
            </Link>
            <a
              href="#features"
              className="px-8 py-4 rounded-lg font-body font-semibold text-white text-base border transition-all duration-300 hover:bg-white/5"
              style={{ borderColor: 'rgba(255,255,255,0.15)' }}
              onClick={(e) => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); }}
            >
              See How It Works
            </a>
          </div>

          {/* Customer redirect */}
          <div className="customer-redirect-hero hero-fade-in" style={{ animationDelay: '350ms', color: '#666666', fontSize: '0.82rem', marginTop: '12px' }}>
            Looking to discover bars tonight?{' '}
            <a
              href="https://thepartygoers.fun"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold transition-colors duration-150 hover:underline"
              style={{ color: '#E8001E' }}
            >
              Visit thepartygoers.fun →
            </a>
          </div>

          {/* Stat pills */}
          <div className="flex flex-wrap gap-4 mt-14 hero-fade-in" style={{ animationDelay: '400ms' }}>
            {['500+ Bars', '10K+ Reservations', '99.9% Uptime'].map((s) => (
              <div
                key={s}
                className="flex items-center gap-2 px-4 py-2 rounded-full font-body text-sm text-gray-400"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {s}
              </div>
            ))}
          </div>
        </div>

        {/* Floating dashboard mockup */}
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 w-[520px] hidden xl:block hero-fade-in floating-card"
          style={{ animationDelay: '500ms', right: '-40px' }}
        >
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(22,22,22,0.85)',
              border: '1px solid rgba(204,0,0,0.2)',
              boxShadow: '0 0 80px rgba(204,0,0,0.12), 0 40px 80px rgba(0,0,0,0.6)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/40" />
              <div className="w-3 h-3 rounded-full bg-green-500/40" />
              <div className="flex-1 mx-4 h-5 rounded bg-white/5 text-[10px] text-gray-600 flex items-center px-2">platform.barsystem.ph</div>
            </div>
            {/* Dashboard preview */}
            <div className="p-5">
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Revenue', value: '₱184,500', up: true },
                  { label: 'Reservations', value: '247', up: true },
                  { label: 'Staff Active', value: '18', up: false },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-[10px] text-gray-500 font-body mb-1">{s.label}</p>
                    <p className="text-white font-display text-lg leading-none">{s.value}</p>
                    <p className={`text-[10px] mt-1 font-body ${s.up ? 'text-green-400' : 'text-red-400'}`}>{s.up ? '↑ 12%' : '→ Stable'}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(204,0,0,0.06)', border: '1px solid rgba(204,0,0,0.15)' }}>
                <p className="text-[10px] text-gray-400 font-body mb-2">Recent Reservations</p>
                {['Table 4 — VIP', 'Table 7 — Birthday', 'Table 2 — Regular'].map((r, i) => (
                  <div key={r} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                    <span className="text-[11px] text-gray-300 font-body">{r}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-body" style={{ background: 'rgba(204,0,0,0.2)', color: '#FF6666' }}>Confirmed</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {['Staff', 'Payroll', 'Events', 'Analytics'].map((m) => (
                  <div key={m} className="rounded-lg p-2 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-[10px] text-gray-500 font-body">{m}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none" style={{ background: 'linear-gradient(to bottom, transparent, #0A0A0A)' }} />
    </section>
  );
};

export default Hero;
