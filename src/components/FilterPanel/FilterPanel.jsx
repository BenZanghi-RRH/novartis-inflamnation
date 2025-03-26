import React from 'react';
import './FilterPanel.css';

function FilterPanel({ diseaseTypes, activeFilters, onToggleFilter }) {
  // Count number of active filters
  const activeCount = Object.values(activeFilters).filter(Boolean).length;

  return (
    <div className="filter-panel">
      <div className="filter-header">
        <h1>
          <span className="brand-name">Inflam</span>
          <span className="brand-name-accent">nation</span>
          <span className="pin-icon">📍</span>
        </h1>
        {activeCount > 0 && (
          <div className="filter-summary">
            Showing {activeCount} condition{activeCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>
      
      <div className="filter-controls">
        {diseaseTypes.map((disease) => (
          <div key={disease} className="filter-item">
            <label className={`filter-label ${activeFilters[disease] ? 'active-filter' : ''}`}>
              <span>{disease}</span>
              <div className={`toggle-switch ${activeFilters[disease] ? 'active' : 'inactive'}`}>
                <input
                  type="checkbox"
                  checked={activeFilters[disease]}
                  onChange={(e) => onToggleFilter(disease, e.target.checked)}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-text">{activeFilters[disease] ? 'on' : 'off'}</span>
              </div>
            </label>
          </div>
        ))}
      </div>
      
      <div className="menu-button">
        <span className="menu-icon">
          <span></span>
          <span></span>
        </span>
        <span className="menu-text">MENU</span>
      </div>
    </div>
  );
}

export default FilterPanel; 