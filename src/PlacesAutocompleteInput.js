import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Search, Clock, Star } from 'lucide-react';

export default function PlacesAutocompleteInput({ value, onChange, placeholder, onSelect, icon = MapPin }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef();
  const dropdownRef = useRef();

  const Icon = icon;

  const handleInputChange = async (e) => {
    const inputValue = e.target.value;
    onChange(inputValue);
    
    if (!window.google || !inputValue.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    try {
      const service = new window.google.maps.places.AutocompleteService();
      service.getPlacePredictions(
        { 
          input: inputValue, 
          componentRestrictions: { country: 'in' },
          types: ['establishment', 'geocode']
        }, 
        (predictions, status) => {
          setIsLoading(false);
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSuggestions(predictions.slice(0, 5)); // Limit to 5 suggestions
            setShowDropdown(true);
          } else {
            setSuggestions([]);
            setShowDropdown(false);
          }
        }
      );
    } catch (error) {
      setIsLoading(false);
      console.error('Error fetching suggestions:', error);
    }
  };

  const handleSelect = (suggestion) => {
    onChange(suggestion.description);
    setShowDropdown(false);
    setIsFocused(false);
    
    // Get lat/lng using PlacesService
    if (window.google) {
      const map = new window.google.maps.Map(document.createElement('div'));
      const service = new window.google.maps.places.PlacesService(map);
      service.getDetails({ placeId: suggestion.place_id }, (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          onSelect && onSelect(suggestion.description, place.geometry.location.lat(), place.geometry.location.lng());
        }
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      setIsFocused(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && 
          inputRef.current && !inputRef.current.contains(event.target)) {
        setShowDropdown(false);
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Input container */}
      <div className={`relative transition-all duration-300 ease-out
        ${isFocused ? 'scale-[1.02]' : 'scale-100'}
      `}>
        {/* Icon */}
        <div className={`absolute left-3 top-1/2 -translate-y-1/2 transition-all duration-300
          ${isFocused ? 'text-primary-600 scale-110' : 'text-gray-400'}
        `}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full pl-10 pr-12 py-3 sm:py-4 border-2 rounded-xl sm:rounded-2xl 
            transition-all duration-300 text-sm sm:text-base font-medium
            ${isFocused 
              ? 'border-primary-300 bg-white shadow-soft ring-2 ring-primary-100' 
              : 'border-gray-200 bg-gray-50 hover:bg-white hover:border-gray-300'
            }
            focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100
            placeholder-gray-400
          `}
          autoComplete="off"
          onFocus={() => {
            setIsFocused(true);
            if (value && suggestions.length > 0) setShowDropdown(true);
          }}
          onBlur={() => {
            // Delay to allow clicking on suggestions
            setTimeout(() => setIsFocused(false), 150);
          }}
        />

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-600 border-t-transparent"></div>
          </div>
        )}

        {/* Focus indicator */}
        {isFocused && (
          <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 to-secondary-500/5 rounded-xl sm:rounded-2xl -z-10 animate-pulse-gentle"></div>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-strong z-50 overflow-hidden animate-slide-down">
          <div className="max-h-64 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.place_id}
                className={`w-full px-4 py-3 text-left hover:bg-primary-50 transition-all duration-200 flex items-center gap-3 group
                  ${index === 0 ? 'border-b border-gray-100' : ''}
                `}
                onMouseDown={() => handleSelect(suggestion)}
              >
                {/* Icon */}
                <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center group-hover:bg-primary-200 transition-colors duration-200">
                  <MapPin className="w-4 h-4 text-primary-600" />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-700 transition-colors duration-200">
                    {suggestion.structured_formatting?.main_text || suggestion.description}
                  </div>
                  {suggestion.structured_formatting?.secondary_text && (
                    <div className="text-xs text-gray-500 truncate">
                      {suggestion.structured_formatting.secondary_text}
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="w-2 h-2 border-r-2 border-b-2 border-primary-600 rotate-45"></div>
                </div>
              </button>
            ))}
          </div>
          
          {/* Footer */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
            Powered by Google Places
          </div>
        </div>
      )}
    </div>
  );
} 