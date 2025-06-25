import React, { useState, useRef } from 'react';

export default function PlacesAutocompleteInput({ value, onChange, placeholder, onSelect }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef();

  const handleInputChange = async (e) => {
    const inputValue = e.target.value;
    onChange(inputValue);
    if (!window.google || !inputValue) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    const service = new window.google.maps.places.AutocompleteService();
    service.getPlacePredictions({ input: inputValue, componentRestrictions: { country: 'in' } }, (predictions) => {
      if (predictions) {
        setSuggestions(predictions);
        setShowDropdown(true);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    });
  };

  const handleSelect = (suggestion) => {
    onChange(suggestion.description);
    setShowDropdown(false);
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

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm sm:text-base"
        autoComplete="off"
        onFocus={() => value && suggestions.length > 0 && setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
      />
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-1 max-h-56 overflow-y-auto">
          {suggestions.map((s) => (
            <li
              key={s.place_id}
              className="px-4 py-2 cursor-pointer hover:bg-blue-100 text-sm text-gray-800"
              onMouseDown={() => handleSelect(s)}
            >
              {s.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 