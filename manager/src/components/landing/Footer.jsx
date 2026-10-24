import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer
      className="relative pt-16 pb-8 overflow-hidden"
      style={{
        background: '#080808',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Top red line */}
      <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, #CC0000 30%, #CC0000 70%, transparent)' }} />

      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center font-display text-white text-sm"
                style={{ background: '#CC0000' }}
              >
                PBS
              </div>
              <div>
                <p className="font-display text-white text-lg tracking-wider">PLATFORM BAR SYSTEM</p>
              </div>
            </div>
            <p className="font-body text-gray-500 text-sm leading-relaxed max-w-xs">
              The all-in-one bar operations management platform built for Philippine bar owners. Run smarter. Scale faster.
            </p>
            <div className="flex items-center gap-3 mt-6">
              {['FB', 'IG', 'TW'].map((s) => (
                <div
                  key={s}
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-body text-xs text-gray-400 cursor-pointer hover:text-white transition-colors duration-200"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {s}
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-gray-600 mb-5">Platform</p>
            <div className="space-y-3">
              {[
                { label: 'Features', href: '#features' },
                { label: 'Pricing', href: '#pricing' },
                { label: 'How It Works', href: '#how-it-works' },
                { label: 'Login', href: '/login', internal: true },
                { label: 'Register', href: '/login', internal: true },
              ].map((l) => (
                l.internal ? (
                  <Link key={l.label} to={l.href} className="block font-body text-sm text-gray-500 hover:text-white transition-colors duration-200">
                    {l.label}
                  </Link>
                ) : (
                  <a
                    key={l.label}
                    href={l.href}
                    className="block font-body text-sm text-gray-500 hover:text-white transition-colors duration-200"
                    onClick={(e) => {
                      if (l.href.startsWith('#')) {
                        e.preventDefault();
                        document.getElementById(l.href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    {l.label}
                  </a>
                )
              ))}
            </div>
          </div>

          {/* Legal */}
          <div>
            <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-gray-600 mb-5">Legal</p>
            <div className="space-y-3">
              {['Privacy Policy', 'Terms of Service', 'Contact Us'].map((l) => (
                <a key={l} href="#" className="block font-body text-sm text-gray-500 hover:text-white transition-colors duration-200">
                  {l}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-8"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <p className="font-body text-gray-600 text-xs">
            © 2025 Platform Bar System. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#CC0000', boxShadow: '0 0 6px rgba(204,0,0,0.8)' }} />
            <p className="font-body text-gray-600 text-xs">Built for Philippine Bar Owners</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
