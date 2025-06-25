import React, { useState, useEffect } from 'react';

export default function AnimatedTitle() {
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const fullText = 'COIMBUDDY';
  const typingSpeed = 200;
  const deletingSpeed = 100;
  const pauseTime = 2000;

  useEffect(() => {
    let timeout;

    if (!isDeleting && text === fullText) {
      // Pause at the end before deleting
      timeout = setTimeout(() => setIsDeleting(true), pauseTime);
    } else if (isDeleting && text === '') {
      // Pause at the beginning before typing
      timeout = setTimeout(() => setIsDeleting(false), pauseTime);
    } else {
      // Type or delete
      timeout = setTimeout(() => {
        if (isDeleting) {
          setText(text.slice(0, -1));
        } else {
          setText(fullText.slice(0, text.length + 1));
        }
      }, isDeleting ? deletingSpeed : typingSpeed);
    }

    return () => clearTimeout(timeout);
  }, [text, isDeleting, fullText, typingSpeed, deletingSpeed, pauseTime]);

  return (
    <div className="text-center mb-6">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-2">
        {text}
        <span className="animate-pulse">|</span>
      </h1>
      <p className="text-gray-600 text-sm sm:text-base">Share rides, save money, go green</p>
    </div>
  );
} 