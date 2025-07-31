import React, { useState, useEffect } from 'react';
import { Car, Users, Leaf, Zap } from 'lucide-react';

export default function AnimatedTitle() {
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentIcon, setCurrentIcon] = useState(0);
  const fullText = 'COIMBUDDY';
  const typingSpeed = 150;
  const deletingSpeed = 80;
  const pauseTime = 2500;

  const icons = [
    { icon: Car, color: 'text-primary-600' },
    { icon: Users, color: 'text-secondary-600' },
    { icon: Leaf, color: 'text-success-600' },
    { icon: Zap, color: 'text-warning-600' },
  ];

  useEffect(() => {
    let timeout;

    if (!isDeleting && text === fullText) {
      timeout = setTimeout(() => setIsDeleting(true), pauseTime);
    } else if (isDeleting && text === '') {
      timeout = setTimeout(() => {
        setIsDeleting(false);
        setCurrentIcon((prev) => (prev + 1) % icons.length);
      }, pauseTime);
    } else {
      timeout = setTimeout(() => {
        if (isDeleting) {
          setText(text.slice(0, -1));
        } else {
          setText(fullText.slice(0, text.length + 1));
        }
      }, isDeleting ? deletingSpeed : typingSpeed);
    }

    return () => clearTimeout(timeout);
  }, [text, isDeleting, fullText, typingSpeed, deletingSpeed, pauseTime, icons.length]);

  const CurrentIcon = icons[currentIcon].icon;

  return (
    <div className="text-center mb-8 animate-fade-in">
      <div className="relative inline-block">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-secondary-600 to-primary-600 mb-3 relative">
          {text}
          <span className="animate-pulse text-primary-600">|</span>
        </h1>
        
        {/* Floating icon */}
        <div className="absolute -top-2 -right-8 sm:-right-12 animate-float">
          <div className={`p-2 rounded-full bg-white/90 backdrop-blur-sm shadow-soft ${icons[currentIcon].color}`}>
            <CurrentIcon className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
        </div>

        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary-600/20 via-secondary-600/20 to-primary-600/20 blur-xl -z-10 animate-glow"></div>
      </div>
      
      <p className="text-gray-600 text-base sm:text-lg font-medium animate-slide-up">
        <span className="inline-flex items-center gap-2">
          <span className="w-2 h-2 bg-success-500 rounded-full animate-pulse-gentle"></span>
          Share rides, save money, go green
        </span>
      </p>
      
      {/* Feature highlights */}
      <div className="flex justify-center items-center gap-6 mt-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Car className="w-4 h-4 text-primary-500" />
          <span>Smart Matching</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users className="w-4 h-4 text-secondary-500" />
          <span>Community</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Leaf className="w-4 h-4 text-success-500" />
          <span>Eco-Friendly</span>
        </div>
      </div>
    </div>
  );
} 