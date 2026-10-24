import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const FinalCTA = () => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('lp-visible'); obs.disconnect(); } },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="relative py-32 overflow-hidden bg-[#0A0A0A]">
      {/* Dramatic red bloom behind text */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(204,0,0,0.18) 0%, rgba(204,0,0,0.06) 40%, transparent 70%)' }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(204,0,0,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }}
      />

      {/* Noise grain */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '150px',
        }}
      />

      <div ref={ref} className="lp-reveal relative z-10 max-w-4xl mx-auto px-6 text-center">
        <p className="text-xs font-body font-bold uppercase tracking-[0.25em] mb-6" style={{ color: '#CC0000' }}>
          Ready to Level Up?
        </p>

        <h2
          className="font-display text-white leading-none mb-6"
          style={{ fontSize: 'clamp(52px, 8vw, 110px)', letterSpacing: '0.02em' }}
        >
          YOUR BAR DESERVES{' '}
          <span style={{ color: '#CC0000' }}>BETTER TOOLS.</span>
        </h2>

        <p className="font-body text-gray-400 text-xl leading-relaxed mb-12 max-w-2xl mx-auto">
          Join bar owners who are already running smarter operations with the Platform Bar System.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/login"
            className="relative group px-10 py-5 rounded-xl font-body font-bold text-white text-lg overflow-hidden transition-all duration-300 glow-btn-red"
            style={{
              background: '#CC0000',
              boxShadow: '0 0 40px rgba(204,0,0,0.5), 0 0 80px rgba(204,0,0,0.2)',
            }}
          >
            <span className="relative z-10">Register Your Bar Now</span>
            <span
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: 'linear-gradient(135deg, #FF1A1A 0%, #CC0000 100%)' }}
            />
          </Link>
        </div>

        <p className="font-body text-gray-600 text-sm mt-5">
          Free to register. No credit card required.
        </p>

        {/* Decorative lines */}
        <div className="mt-16 flex items-center gap-4">
          <div className="flex-1 h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06))' }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#CC0000', boxShadow: '0 0 8px rgba(204,0,0,0.8)' }} />
          <div className="flex-1 h-[1px]" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent)' }} />
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
