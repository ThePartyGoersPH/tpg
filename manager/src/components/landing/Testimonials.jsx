import React, { useEffect, useRef } from 'react';

const TESTIMONIALS = [
  {
    quote: "Before this platform, payroll took us 3 days every cutoff. Now it's done in minutes. I can't imagine going back.",
    name: 'Marco R.',
    bar: 'Eclipse Bar',
    location: 'Cavite',
    emoji: '🍸',
  },
  {
    quote: "Managing 3 branches used to be a nightmare. Now I see everything in one dashboard — reservations, staff, revenue. Game changer.",
    name: 'Gia T.',
    bar: 'The Vault Lounge',
    location: 'Cavite',
    emoji: '🥂',
  },
  {
    quote: "The role-based permissions alone saved us from so many headaches. Each staff member sees exactly what they need to.",
    name: 'Aldrin M.',
    bar: 'After Hours Bar',
    location: 'Cavite',
    emoji: '🍺',
  },
];

const TestimonialCard = ({ quote, name, bar, location, emoji, index }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setTimeout(() => el.classList.add('lp-visible'), index * 150);
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [index]);

  return (
    <div
      ref={ref}
      className="lp-reveal rounded-2xl p-7 flex flex-col"
      style={{
        background: 'rgba(17,17,17,0.8)',
        border: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Quote marks */}
      <div className="font-display text-6xl leading-none mb-4" style={{ color: '#CC0000', opacity: 0.4 }}>"</div>

      <p className="font-body text-gray-300 text-base leading-relaxed flex-1 mb-6 -mt-4">
        {quote}
      </p>

      <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: 'rgba(204,0,0,0.12)', border: '1px solid rgba(204,0,0,0.25)' }}
        >
          {emoji}
        </div>
        <div>
          <p className="font-body font-semibold text-white text-sm">{name}</p>
          <p className="font-body text-gray-500 text-xs">{bar} · {location}</p>
        </div>
      </div>
    </div>
  );
};

const Testimonials = () => {
  const headerRef = useRef(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('lp-visible'); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="relative py-28 bg-[#0A0A0A] overflow-hidden">
      <div
        className="absolute top-1/2 -translate-y-1/2 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(204,0,0,0.06) 0%, transparent 70%)', right: '-150px' }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div ref={headerRef} className="lp-reveal text-center mb-14">
          <p className="text-xs font-body font-bold uppercase tracking-[0.25em] mb-4" style={{ color: '#CC0000' }}>
            What Bar Owners Say
          </p>
          <h2
            className="font-display text-white leading-none"
            style={{ fontSize: 'clamp(44px, 6vw, 80px)', letterSpacing: '0.02em' }}
          >
            REAL OWNERS.{' '}
            <span style={{ color: '#CC0000' }}>REAL RESULTS.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard key={t.name} {...t} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
