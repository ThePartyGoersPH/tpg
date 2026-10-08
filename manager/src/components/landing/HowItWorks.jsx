import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const STEPS = [
  { num: '01', title: 'Register Your Bar', desc: 'Create your bar owner account and set up your profile in minutes.' },
  { num: '02', title: 'Set Up Your Branch', desc: 'Add your bar details, tables, menu, and operating hours.' },
  { num: '03', title: 'Build Your Team', desc: 'Invite staff, assign roles, and set their permissions granularly.' },
  { num: '04', title: 'Go Live', desc: 'Start managing reservations, payroll, events, and analytics from day one.' },
];

const StepCard = ({ num, title, desc, index }) => {
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
    <div ref={ref} className="lp-reveal relative">
      <div
        className="relative w-20 h-20 rounded-full flex items-center justify-center mb-6 mx-auto lg:mx-0"
        style={{
          background: 'rgba(204,0,0,0.1)',
          border: '1px solid rgba(204,0,0,0.35)',
          boxShadow: '0 0 20px rgba(204,0,0,0.15)',
        }}
      >
        <span className="font-display text-2xl" style={{ color: '#CC0000' }}>{num}</span>
        <div
          className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full hidden lg:block"
          style={{ background: '#CC0000', boxShadow: '0 0 8px rgba(204,0,0,0.8)' }}
        />
      </div>
      <h3 className="font-display text-white text-2xl mb-3 tracking-wide text-center lg:text-left">{title}</h3>
      <p className="font-body text-gray-500 text-sm leading-relaxed text-center lg:text-left">{desc}</p>
    </div>
  );
};

const HowItWorks = () => {
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
        className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(204,0,0,0.07) 0%, transparent 70%)', right: '-100px', bottom: '-100px' }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div ref={headerRef} className="lp-reveal text-center mb-20">
          <p className="text-xs font-body font-bold uppercase tracking-[0.25em] mb-4" style={{ color: '#CC0000' }}>
            How It Works
          </p>
          <h2
            className="font-display text-white leading-none"
            style={{ fontSize: 'clamp(44px, 6vw, 80px)', letterSpacing: '0.02em' }}
          >
            FOUR STEPS TO{' '}
            <span style={{ color: '#CC0000' }}>FULL CONTROL.</span>
          </h2>
        </div>

        <div className="relative">
          <div
            className="absolute top-10 left-0 right-0 h-[1px] hidden lg:block"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(204,0,0,0.3), rgba(204,0,0,0.3), transparent)' }}
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((step, i) => (
              <StepCard key={step.num} {...step} index={i} />
            ))}
          </div>
        </div>

        <div className="text-center mt-16">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-body font-semibold text-white text-base transition-all duration-300"
            style={{ background: 'linear-gradient(135deg, #CC0000, #991500)', boxShadow: '0 0 30px rgba(204,0,0,0.35)' }}
          >
            Start Now — It's Free to Register
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
