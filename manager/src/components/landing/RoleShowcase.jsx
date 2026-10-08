import React, { useState, useEffect, useRef } from 'react';

const ROLES = [
  {
    id: 'owner',
    label: 'Bar Owner',
    emoji: '👑',
    tagline: 'Full Command',
    desc: 'Complete visibility and control across every aspect of your bar — branches, finances, staff, and growth analytics.',
    color: '#CC0000',
    features: [
      { icon: '🏢', text: 'Multi-branch management' },
      { icon: '📊', text: 'Full analytics & financials' },
      { icon: '👥', text: 'All staff & permissions' },
      { icon: '💰', text: 'Payroll & deductions' },
      { icon: '🔐', text: 'Subscription & billing' },
      { icon: '📋', text: 'Activity history & documents' },
      { icon: '🍺', text: 'Menu & inventory control' },
      { icon: '📅', text: 'Reservations & tables' },
    ],
  },
  {
    id: 'manager',
    label: 'Manager',
    emoji: '🎯',
    tagline: 'Operations Control',
    desc: 'Run day-to-day operations seamlessly — oversee staff, process payroll, manage events, and handle customer flow.',
    color: '#e67e22',
    features: [
      { icon: '👥', text: 'Staff oversight & attendance' },
      { icon: '💰', text: 'Payroll generation' },
      { icon: '📅', text: 'Reservation management' },
      { icon: '🎉', text: 'Events & posts' },
      { icon: '🍺', text: 'Menu management' },
      { icon: '📦', text: 'Inventory tracking' },
      { icon: '🛎️', text: 'Customer management' },
      { icon: '📝', text: 'Leave approvals' },
    ],
  },
  {
    id: 'employee',
    label: 'Employee',
    emoji: '🙋',
    tagline: 'Personal Portal',
    desc: 'A clean, personal view for staff — check their own attendance, see payslips, request leaves, and access documents.',
    color: '#3b82f6',
    features: [
      { icon: '🕐', text: 'Own attendance record' },
      { icon: '💸', text: 'Personal payslips' },
      { icon: '📅', text: 'Leave requests' },
      { icon: '📄', text: 'Own documents' },
      { icon: '👤', text: 'Profile management' },
    ],
  },
];

const RoleShowcase = () => {
  const [active, setActive] = useState('owner');
  const ref = useRef(null);
  const role = ROLES.find((r) => r.id === active);

  useEffect(() => {
    const el = ref.current;
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
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(204,0,0,0.06) 0%, transparent 70%)' }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div ref={ref} className="lp-reveal text-center mb-14">
          <p className="text-xs font-body font-bold uppercase tracking-[0.25em] mb-4" style={{ color: '#CC0000' }}>
            Role Showcase
          </p>
          <h2
            className="font-display text-white leading-none mb-4"
            style={{ fontSize: 'clamp(44px, 6vw, 80px)', letterSpacing: '0.02em' }}
          >
            THE RIGHT VIEW{' '}
            <span style={{ color: '#CC0000' }}>FOR EVERY ROLE.</span>
          </h2>
          <p className="font-body text-gray-500 text-lg max-w-xl mx-auto">
            Every team member gets exactly the access they need — no more, no less.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center gap-3 mb-12 flex-wrap">
          {ROLES.map((r) => (
            <button
              key={r.id}
              onClick={() => setActive(r.id)}
              className="flex items-center gap-2 px-6 py-3 rounded-full font-body font-semibold text-sm transition-all duration-300"
              style={
                active === r.id
                  ? { background: r.color, color: '#fff', boxShadow: `0 0 20px ${r.color}60` }
                  : { background: 'var(--m-active-bg)', color: '#888', border: '1px solid var(--m-border)' }
              }
            >
              <span>{r.emoji}</span>
              {r.label}
            </button>
          ))}
        </div>

        {/* Role detail card */}
        <div
          key={active}
          className="rounded-2xl overflow-hidden role-card-enter"
          style={{
            background: 'var(--m-surface)',
            border: `1px solid ${role.color}30`,
            boxShadow: `0 0 60px ${role.color}10`,
          }}
        >
          <div className="grid lg:grid-cols-2 gap-0">
            {/* Left: description */}
            <div
              className="p-8 lg:p-12 border-b lg:border-b-0 lg:border-r"
              style={{ borderColor: 'var(--m-border)' }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ background: `${role.color}15`, border: `1px solid ${role.color}40` }}
                >
                  {role.emoji}
                </div>
                <div>
                  <p className="font-body text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: role.color }}>
                    {role.tagline}
                  </p>
                  <h3 className="font-display text-white text-3xl tracking-wide">{role.label}</h3>
                </div>
              </div>
              <p className="font-body text-gray-400 text-base leading-relaxed mb-8">{role.desc}</p>

              {/* Access level bar */}
              <div className="space-y-3">
                <p className="font-body text-xs text-gray-600 uppercase tracking-widest">Access Level</p>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--m-active-bg)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: role.id === 'owner' ? '100%' : role.id === 'manager' ? '72%' : '35%',
                      background: `linear-gradient(90deg, ${role.color}, ${role.color}80)`,
                      boxShadow: `0 0 10px ${role.color}60`,
                    }}
                  />
                </div>
                <p className="font-body text-xs text-gray-600">
                  {role.id === 'owner' ? 'Full platform access' : role.id === 'manager' ? 'Operations access' : 'Personal access only'}
                </p>
              </div>
            </div>

            {/* Right: features grid */}
            <div className="p-8 lg:p-12">
              <p className="font-body text-xs font-bold uppercase tracking-widest text-gray-600 mb-6">What They Can Access</p>
              <div className="grid grid-cols-2 gap-3">
                {role.features.map((f) => (
                  <div
                    key={f.text}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: 'var(--m-active-bg)', border: '1px solid var(--m-border)' }}
                  >
                    <span className="text-base flex-shrink-0">{f.icon}</span>
                    <span className="font-body text-gray-300 text-xs leading-snug">{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RoleShowcase;
