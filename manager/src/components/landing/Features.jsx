import React, { useEffect, useRef } from 'react';

const FEATURES = [
  {
    icon: '🍺',
    title: 'Menu & POS Integration',
    desc: 'Manage your menu and push items live to your customer app and POS instantly.',
  },
  {
    icon: '📅',
    title: 'Reservations',
    desc: 'Track paid reservations, table status, and customer details in real time.',
  },
  {
    icon: '👥',
    title: 'Staff Management',
    desc: 'Manage your team, set permissions, reset passwords, track attendance and leaves.',
  },
  {
    icon: '💰',
    title: 'Payroll & Deductions',
    desc: 'Automate payroll, finalize salary, and manage deductions per employee.',
  },
  {
    icon: '📊',
    title: 'Bar Analytics',
    desc: 'Revenue trends, peak hours, reservation volume — all in one analytics dashboard.',
  },
  {
    icon: '🎉',
    title: 'Events & Posts',
    desc: 'Create events, publish posts, manage customer engagement from one place.',
  },
  {
    icon: '🔐',
    title: 'Role-Based Access',
    desc: 'Assign custom permissions per staff member — total control over who sees what.',
  },
  {
    icon: '🏢',
    title: 'Multi-Branch Support',
    desc: 'Manage multiple branches under one account with subscription-aware controls.',
  },
  {
    icon: '📋',
    title: 'Documents & Logs',
    desc: 'Send documents to staff and track all system activity with full audit logs.',
  },
];

const FeatureCard = ({ icon, title, desc, index }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setTimeout(() => el.classList.add('lp-visible'), index * 80);
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
      className="lp-reveal group relative rounded-2xl p-6 transition-all duration-300 cursor-default"
      style={{
        background: 'rgba(17,17,17,0.8)',
        border: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Hover red glow border */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: '0 0 0 1px rgba(204,0,0,0.4), 0 0 30px rgba(204,0,0,0.1)' }}
      />

      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 transition-transform duration-300 group-hover:scale-110"
        style={{ background: 'rgba(204,0,0,0.1)', border: '1px solid rgba(204,0,0,0.2)' }}
      >
        {icon}
      </div>
      <h3 className="font-display text-white text-xl mb-2 tracking-wide">{title}</h3>
      <p className="font-body text-gray-500 text-sm leading-relaxed">{desc}</p>

      {/* Bottom red line reveal on hover */}
      <div
        className="absolute bottom-0 left-6 right-6 h-[1px] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"
        style={{ background: 'linear-gradient(90deg, #CC0000, transparent)' }}
      />
    </div>
  );
};

const Features = () => {
  const headerRef = useRef(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('lp-visible'); obs.disconnect(); } },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="features" className="relative py-28 bg-[#0F0F0F] overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(204,0,0,0.04) 0%, transparent 70%)' }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div ref={headerRef} className="lp-reveal text-center mb-16">
          <p className="text-xs font-body font-bold uppercase tracking-[0.25em] mb-4" style={{ color: '#CC0000' }}>
            Core Features
          </p>
          <h2
            className="font-display text-white leading-none mb-4"
            style={{ fontSize: 'clamp(44px, 6vw, 80px)', letterSpacing: '0.02em' }}
          >
            BUILT FOR THE{' '}
            <span style={{ color: '#CC0000' }}>BAR INDUSTRY.</span>
          </h2>
          <p className="font-body text-gray-500 text-lg max-w-xl mx-auto">
            Every feature was designed with one goal — to give bar owners total command of their operations.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} {...f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
