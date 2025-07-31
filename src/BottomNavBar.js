import React from 'react';
import { Car, Book, Phone, UserCircle2, Play, Users, MessageCircle, MapPin, Clock, Star } from 'lucide-react';

const buddyTabs = [
  { key: 'book', label: 'Book Ride', icon: Car, color: 'primary' },
  { key: 'bookings', label: 'My Trips', icon: Book, color: 'secondary' },
  { key: 'chat', label: 'Chat', icon: MessageCircle, color: 'success' },
  { key: 'contact', label: 'Support', icon: Phone, color: 'warning' },
  { key: 'account', label: 'Profile', icon: UserCircle2, color: 'danger' },
];

const pilotTabs = [
  { key: 'start', label: 'Start Trip', icon: Play, color: 'primary' },
  { key: 'passengers', label: 'Passengers', icon: Users, color: 'secondary' },
  { key: 'chat', label: 'Chat', icon: MessageCircle, color: 'success' },
  { key: 'contact', label: 'Support', icon: Phone, color: 'warning' },
  { key: 'account', label: 'Profile', icon: UserCircle2, color: 'danger' },
];

export default function BottomNavBar({ currentTab, onTabChange, userType = 'buddy' }) {
  const tabs = userType === 'pilot' ? pilotTabs : buddyTabs;
  
  const getColorClasses = (color, isActive) => {
    const colorMap = {
      primary: isActive ? 'text-primary-600 bg-primary-50 border-primary-200' : 'text-gray-500 hover:text-primary-600',
      secondary: isActive ? 'text-secondary-600 bg-secondary-50 border-secondary-200' : 'text-gray-500 hover:text-secondary-600',
      success: isActive ? 'text-success-600 bg-success-50 border-success-200' : 'text-gray-500 hover:text-success-600',
      warning: isActive ? 'text-warning-600 bg-warning-50 border-warning-200' : 'text-gray-500 hover:text-warning-600',
    };
    return colorMap[color] || colorMap.primary;
  };

  const getGlowClass = (color) => {
    const glowMap = {
      primary: 'shadow-glow',
      secondary: 'shadow-glow-purple',
      success: 'shadow-green-500/30',
      warning: 'shadow-yellow-500/30',
    };
    return glowMap[color] || glowMap.primary;
  };
  
  return (
    <div className="w-full">
      <nav className="relative w-full rounded-2xl shadow-strong border border-white/20 bg-white/80 backdrop-blur-xl flex justify-around items-center h-20 px-2 transition-all duration-300">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary-50/50 via-white/80 to-secondary-50/50 rounded-2xl"></div>
        
        {/* Active tab indicator */}
        {tabs.map((tab, index) => {
          const isActive = currentTab === tab.key;
          if (isActive) {
            return (
              <div
                key={`indicator-${tab.key}`}
                className="absolute top-0 left-0 h-full w-1/4 bg-gradient-to-r from-primary-100/50 to-secondary-100/50 rounded-2xl transition-all duration-300 ease-out"
                style={{ transform: `translateX(${index * 100}%)` }}
              />
            );
          }
          return null;
        })}
        
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`relative flex flex-col items-center justify-center flex-1 h-full focus:outline-none transition-all duration-300 ease-out group
                ${isActive ? 'scale-110 z-10' : 'hover:scale-105'}
              `}
            >
              {/* Icon container */}
              <div className={`relative p-3 rounded-xl transition-all duration-300 border-2
                ${isActive 
                  ? `${getColorClasses(tab.color, true)} ${getGlowClass(tab.color)}` 
                  : 'border-transparent bg-transparent'
                }
                ${!isActive ? 'group-hover:bg-gray-50/50 group-hover:border-gray-200/50' : ''}
              `}>
                <Icon 
                  className={`w-6 h-6 transition-all duration-300
                    ${isActive ? 'stroke-2' : 'stroke-1 group-hover:stroke-2'}
                    ${getColorClasses(tab.color, isActive).split(' ')[0]}
                  `}
                />
                
                {/* Active indicator dot */}
                {isActive && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full animate-pulse-gentle"></div>
                )}
              </div>
              
              {/* Label */}
              <span className={`text-xs font-semibold mt-1 transition-all duration-300 tracking-wide
                ${isActive ? 'text-gray-800 font-bold' : 'text-gray-500 group-hover:text-gray-700'}
              `}>
                {tab.label}
              </span>
              
              {/* Hover effect */}
              {!isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 to-secondary-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
} 