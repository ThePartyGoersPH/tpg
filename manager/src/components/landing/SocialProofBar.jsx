import React from 'react';

const stats = [
  { value: '500+', label: 'Bars Managed' },
  { value: '10,000+', label: 'Reservations Processed' },
  { value: '99.9%', label: 'Uptime Guaranteed' },
  { value: '50+', label: 'Cities in the Philippines' },
  { value: '5,000+', label: 'Staff Accounts' },
  { value: '₱50M+', label: 'Payroll Processed' },
  { value: '500+', label: 'Bars Managed' },
  { value: '10,000+', label: 'Reservations Processed' },
  { value: '99.9%', label: 'Uptime Guaranteed' },
  { value: '50+', label: 'Cities in the Philippines' },
  { value: '5,000+', label: 'Staff Accounts' },
  { value: '₱50M+', label: 'Payroll Processed' },
];

const SocialProofBar = () => {
  return (
    <section
      className="relative py-6 overflow-hidden"
      style={{
        background: '#111111',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Red line accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #CC0000, transparent)' }} />

      <div className="flex marquee-track">
        {stats.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-8 flex-shrink-0 px-8"
          >
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#CC0000', boxShadow: '0 0 8px rgba(204,0,0,0.8)' }} />
              <span className="font-display text-white text-2xl tracking-wider">{s.value}</span>
              <span className="font-body text-gray-500 text-sm whitespace-nowrap">{s.label}</span>
            </div>
            <span className="text-white/10 font-body text-lg">|</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default SocialProofBar;
