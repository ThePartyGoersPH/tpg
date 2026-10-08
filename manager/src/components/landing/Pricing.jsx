import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const PLANS = [
  {
    name: 'Starter',
    price: 'Free',
    sub: 'to register',
    desc: 'Perfect for single-branch bars getting started.',
    popular: false,
    color: 'rgba(255,255,255,0.08)',
    borderColor: 'var(--m-border)',
    features: [
      '1 Branch',
      'Up to 10 Staff Accounts',
      'Menu & Reservations',
      'Basic Attendance',
      'Payroll (manual)',
      'Community Support',
    ],
    cta: 'Get Started Free',
    ctaStyle: { background: 'var(--m-active-bg)', color: '#fff', border: '1px solid var(--m-border)' },
  },
  {
    name: 'Pro',
    price: '₱1,499',
    sub: '/ month per branch',
    desc: 'For serious bar owners who want full control and automation.',
    popular: true,
    color: 'rgba(204,0,0,0.08)',
    borderColor: 'rgba(204,0,0,0.5)',
    features: [
      'Up to 3 Branches',
      'Unlimited Staff Accounts',
      'Full Payroll & Deductions',
      'Analytics Dashboard',
      'Events & Posts',
      'Role-Based Permissions',
      'Document Management',
      'Activity History',
      'Priority Support',
    ],
    cta: 'Start Pro',
    ctaStyle: { background: '#CC0000', color: '#fff', boxShadow: '0 0 25px rgba(204,0,0,0.4)' },
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    sub: 'contact us',
    desc: 'Built for bar groups, chains, and large-scale operations.',
    popular: false,
    color: 'rgba(255,255,255,0.04)',
    borderColor: 'var(--m-border)',
    features: [
      'Unlimited Branches',
      'Dedicated Account Manager',
      'Custom Integrations',
      'White-label Options',
      'SLA Guarantee',
      'Onboarding & Training',
      'Custom Analytics',
    ],
    cta: 'Contact Us',
    ctaStyle: { background: 'var(--m-active-bg)', color: '#fff', border: '1px solid var(--m-border)' },
  },
];

const PlanCard = ({ plan, index }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setTimeout(() => el.classList.add('lp-visible'), index * 120);
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
      className="lp-reveal relative rounded-2xl p-7 flex flex-col"
      style={{
        background: plan.color,
        border: `1px solid ${plan.borderColor}`,
        boxShadow: plan.popular ? '0 0 60px rgba(204,0,0,0.12)' : 'none',
      }}
    >
      {plan.popular && (
        <div
          className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full font-body text-xs font-bold text-white"
          style={{ background: '#CC0000', boxShadow: '0 0 12px rgba(204,0,0,0.5)' }}
        >
          Most Popular
        </div>
      )}

      <div className="mb-6">
        <p className="font-body text-xs font-bold uppercase tracking-widest mb-3" style={{ color: plan.popular ? '#CC0000' : '#888' }}>
          {plan.name}
        </p>
        <div className="flex items-end gap-2 mb-2">
          <span className="font-display text-white leading-none" style={{ fontSize: '2.5rem' }}>{plan.price}</span>
          <span className="font-body text-gray-500 text-sm mb-1">{plan.sub}</span>
        </div>
        <p className="font-body text-gray-500 text-sm">{plan.desc}</p>
      </div>

      <div className="space-y-3 flex-1 mb-7">
        {plan.features.map((f) => (
          <div key={f} className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
              style={{ background: plan.popular ? 'rgba(204,0,0,0.2)' : 'var(--m-active-bg)' }}
            >
              <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                <path d="M1 3L3 5L7 1" stroke={plan.popular ? '#CC0000' : '#666'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-body text-gray-300 text-sm">{f}</span>
          </div>
        ))}
      </div>

      <Link
        to="/login"
        className="block text-center py-3 rounded-xl font-body font-semibold text-sm transition-all duration-300 hover:opacity-90"
        style={plan.ctaStyle}
      >
        {plan.cta}
      </Link>
    </div>
  );
};

const Pricing = () => {
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
    <section className="relative py-28 overflow-hidden" style={{ background: '#0F0F0F' }}>
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(204,0,0,0.05) 0%, transparent 70%)' }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div ref={headerRef} className="lp-reveal text-center mb-14">
          <p className="text-xs font-body font-bold uppercase tracking-[0.25em] mb-4" style={{ color: '#CC0000' }}>
            Pricing
          </p>
          <h2
            className="font-display text-white leading-none mb-4"
            style={{ fontSize: 'clamp(44px, 6vw, 80px)', letterSpacing: '0.02em' }}
          >
            PLANS THAT SCALE{' '}
            <span style={{ color: '#CC0000' }}>WITH YOU.</span>
          </h2>
          <p className="font-body text-gray-500 text-base">
            Subscription details and branch limits apply.{' '}
            <span className="text-gray-400">Contact us for custom plans.</span>
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 items-start">
          {PLANS.map((plan, i) => (
            <PlanCard key={plan.name} plan={plan} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
