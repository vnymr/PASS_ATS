"use client";

import React, { useState, useEffect } from 'react';
import { Github, Instagram, Linkedin, Menu, X } from 'lucide-react';
import Image from 'next/image';
import logoImage from '@/assets/LoDi-Letter \'r\' with a subtle, elongated tail forming a wave. The character stands alone, bold, yet subtly suggestive of fluidity.-2025-09-09-08_20_02-m6jvbyllg1jgspoccvhlj 2.png';



const GetExtensionButton: React.FC = () => {
  const handleClick = () => {
    // You can add the Chrome Web Store link here when ready
    window.open('https://chrome.google.com/webstore', '_blank');
  };

  return (
    <div className="relative z-10 w-full">
      <button
        onClick={handleClick}
        className="px-8 sm:px-12 py-4 sm:py-5 rounded-full bg-white hover:bg-gray-100 text-black text-lg sm:text-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-2xl font-space"
      >
        Get The Extension
      </button>
    </div>
  );
};

const GradientBars: React.FC = () => {
  const [numBars] = useState(15);

  const calculateHeight = (index: number, total: number) => {
    const position = index / (total - 1);
    const maxHeight = 100;
    const minHeight = 30;
    
    const center = 0.5;
    const distanceFromCenter = Math.abs(position - center);
    const heightPercentage = Math.pow(distanceFromCenter * 2, 1.2);
    
    return minHeight + (maxHeight - minHeight) * heightPercentage;
  };

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      <div 
        className="flex h-full"
        style={{
          width: '100%',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        {Array.from({ length: numBars }).map((_, index) => {
          const height = calculateHeight(index, numBars);
          return (
            <div
              key={index}
              style={{
                flex: '1 0 calc(100% / 15)',
                maxWidth: 'calc(100% / 15)',
                height: '100%',
                background: 'linear-gradient(to top, rgb(255, 60, 0), transparent)',
                transform: `scaleY(${height / 100})`,
                transformOrigin: 'bottom',
                transition: 'transform 0.5s ease-in-out',
                animation: 'pulseBar 2s ease-in-out infinite alternate',
                animationDelay: `${index * 0.1}s`,
                outline: '1px solid rgba(0, 0, 0, 0)',
                boxSizing: 'border-box',
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent py-6 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Image 
                src={logoImage}
                alt="Resume Logo" 
                width={80}
                height={80}
                className="w-16 h-16 sm:w-20 sm:h-20"
              />
            </div>

          <div className="hidden md:flex items-center">
            <button 
              onClick={() => window.open('https://chrome.google.com/webstore', '_blank')}
              className="bg-white hover:bg-gray-100 text-black px-5 py-2 rounded-full transition-all duration-300 transform hover:scale-105 font-space"
            >
              Get Extension
            </button>
          </div>

          <div className="md:hidden">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-white">
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden mt-4 bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-lg p-4 animate-fadeIn">
            <div className="flex flex-col space-y-4">
              <button 
                onClick={() => window.open('https://chrome.google.com/webstore', '_blank')}
                className="bg-white hover:bg-gray-100 text-black px-5 py-2 rounded-full transition-all duration-300 w-full font-space"
              >
                Get Extension
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export const Component: React.FC = () => {
  return (
    <main className="relative min-h-screen flex flex-col items-center px-6 sm:px-8 md:px-12 overflow-hidden" role="main">
      <div className="absolute inset-0 bg-gray-950"></div>
      <GradientBars />
      <Navbar />
      
      <div className="relative z-10 text-center w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-screen py-8 sm:py-16">
        <header className="w-full text-center mb-6 sm:mb-8 px-4">
          <h1 className="text-white leading-tight tracking-tight animate-fadeIn">
            <span className="block font-instrument italic text-[clamp(1.5rem,6vw,3.75rem)] whitespace-nowrap">
              Make Every Application Count
            </span>
          </h1>
        </header>
        
        <section className="mb-6 sm:mb-10 px-4" aria-labelledby="description">
          <p id="description" className="text-sm sm:text-base text-gray-400 leading-relaxed animate-fadeIn animation-delay-200 font-space max-w-2xl mx-auto">
          Turn your profile + any job post into a one-page, ATS-ready resume. Every time in under 20 seconds.
          </p>
        </section>
        
        <div className="mb-6 sm:mb-8 px-4">
          <GetExtensionButton />
        </div>
        
        <div className="flex justify-center space-x-6">
          <a href="#" className="text-gray-500 hover:text-gray-300 transition-colors duration-300">
            <Instagram size={20} className="w-5 h-5 sm:w-[22px] sm:h-[22px]" />
          </a>
          <a href="#" className="text-gray-500 hover:text-gray-300 transition-colors duration-300">
            <Linkedin size={20} className="w-5 h-5 sm:w-[22px] sm:h-[22px]" />
          </a>
          <a href="#" className="text-gray-500 hover:text-gray-300 transition-colors duration-300">
            <Github size={20} className="w-5 h-5 sm:w-[22px] sm:h-[22px]" />
          </a>
        </div>
      </div>
    </main>
  );
};
