import React from 'react';
import { Car, Book, Phone, UserCircle2, Play, Users, MessageCircle } from 'lucide-react';

const buddyTabs = [
  { key: 'book', label: 'Book Ride', icon: Car },
  { key: 'bookings', label: 'Bookings', icon: Book },
  { key: 'contact', label: 'Contact Me', icon: Phone },
  { key: 'account', label: 'Account', icon: UserCircle2 },
];

const pilotTabs = [
  { key: 'start', label: 'Start Ride', icon: Play },
  { key: 'passengers', label: 'Booked Passengers', icon: Users },
  { key: 'contact', label: 'Contact Queries', icon: MessageCircle },
  { key: 'account', label: 'Account', icon: UserCircle2 },
];

export default function BottomNavBar({ currentTab, onTabChange, userType = 'buddy' }) {
  const tabs = userType === 'pilot' ? pilotTabs : buddyTabs;
  
  return (
    <nav className="w-full rounded-xl shadow-xl border border-gradient-to-r from-blue-300/40 to-purple-300/40 bg-white/40 backdrop-blur-lg flex justify-around items-center h-16 sm:h-20 px-2 sm:px-8 transition-all duration-300 ring-1 ring-blue-200/30">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex flex-col items-center justify-center flex-1 focus:outline-none transition-all duration-200 relative
              ${isActive ? 'text-blue-700 font-bold scale-110 drop-shadow-lg' : 'text-gray-500 hover:text-blue-500'}
            `}
            style={isActive ? { zIndex: 1 } : {}}
          >
            <span className={`rounded-full p-2 transition-all duration-200
              ${isActive ? 'bg-gradient-to-br from-blue-200/60 to-purple-200/60 shadow-lg ring-2 ring-blue-400/30' : ''}
            `}>
              <Icon 
                className={`w-7 h-7 sm:w-8 sm:h-8 mb-1 transition-all duration-200
                  ${isActive ? 'stroke-2 text-blue-700' : 'stroke-1'}
                `}
              />
            </span>
            <span className={`text-xs sm:text-sm font-semibold transition-all duration-200 tracking-wide
              ${isActive ? 'text-blue-700' : 'text-gray-500 group-hover:text-blue-500'}
            `}>
              {tab.label}
            </span>
            {isActive && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full shadow-lg animate-pulse"></span>
            )}
          </button>
        );
      })}
    </nav>
  );
} 