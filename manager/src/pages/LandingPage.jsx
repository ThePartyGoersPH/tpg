import React, { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import Hero from '../components/landing/Hero';
import SocialProofBar from '../components/landing/SocialProofBar';
import WhatIsIt from '../components/landing/WhatIsIt';
import Features from '../components/landing/Features';
import HowItWorks from '../components/landing/HowItWorks';
import RoleShowcase from '../components/landing/RoleShowcase';
import Testimonials from '../components/landing/Testimonials';
import Pricing from '../components/landing/Pricing';
import FinalCTA from '../components/landing/FinalCTA';
import Footer from '../components/landing/Footer';

const Navbar = () => (
  <nav
    className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-12 py-4"
    style={{
      background: 'rgba(10,10,10,0.85)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}
  >
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center font-display text-white text-xs"
       
      >
        <img src="../logo.png" alt="" />
      </div>
      <span className="font-display text-white tracking-widest text-sm hidden sm:block">The Party Goers BarOps</span>
    </div>

    <div className="hidden md:flex items-center gap-7">
      {[
        { label: 'Features', href: 'features' },
        { label: 'How It Works', href: 'how-it-works' },
        { label: 'Pricing', href: 'pricing' },
      ].map((item) => (
        <a
          key={item.label}
          href={`#${item.href}`}
          className="font-body text-sm text-gray-400 hover:text-white transition-colors duration-200"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(item.href)?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          {item.label}
        </a>
      ))}
    </div>

    <div className="flex items-center gap-3">
      <div className="customer-redirect-nav hidden md:flex items-center gap-2 mr-4">
        <span className="text-gray-500 text-xs">Are you a customer?</span>
        <a
          href="https://thepartygoers.fun"
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-500 text-xs font-semibold text-decoration-none border border-red-500/40 px-3 py-1 rounded-full transition-all duration-150 hover:bg-red-500/10 hover:border-red-500"
          style={{ color: '#E8001E', borderColor: 'rgba(232, 0, 30, 0.4)' }}
        >
          Visit Party Goers →
        </a>
      </div>
      <Link
        to="/login"
        className="font-body text-sm text-gray-400 hover:text-white transition-colors duration-200 hidden sm:block"
      >
        Login
      </Link>
      <Link
        to="/login"
        className="font-body text-sm font-semibold text-white px-5 py-2 rounded-lg transition-all duration-300"
        style={{ background: '#CC0000', boxShadow: '0 0 15px rgba(204,0,0,0.3)' }}
      >
        Register Free
      </Link>
    </div>
  </nav>
);

const LandingPage = () => {
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => { document.documentElement.style.scrollBehavior = ''; };
  }, []);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="bg-[#0A0A0A] min-h-screen" style={{ fontFamily: "'DM Sans', Inter, system-ui, sans-serif" }}>
      <Navbar />
      <div className="pt-16">
        <Hero />
        <SocialProofBar />
        <WhatIsIt />
        <div id="features"><Features /></div>
        <div id="how-it-works"><HowItWorks /></div>
        <RoleShowcase />
        <Testimonials />
        <div id="pricing"><Pricing /></div>
        <FinalCTA />
        <Footer />
      </div>
    </div>
  );
};

export default LandingPage;
