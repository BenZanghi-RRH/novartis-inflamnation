import React from 'react';
import './FilterPanel.css';

function FilterPanel({ diseaseTypes, activeFilters, onToggleFilter, counts = {} }) { // Receive counts prop, default to empty object
  // Count number of active filters
  const activeCount = Object.values(activeFilters).filter(Boolean).length;

  return (
    <div className="filter-panel">
      <div className="filter-header">
        <h1>
          <span className="brand-name">Chronic</span>
          <span className="brand-name-accent">Connections</span>
          <span className="pin-icon">📍</span>
        </h1>
        {activeCount > 0 && (
          <div className="filter-summary">
            Showing {activeCount} condition{activeCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>
      
      <div className="filter-controls">
        {diseaseTypes.map((disease) => {
          const count = counts[disease] || 0; // Get count for this disease
          return (
            <div key={disease} className="filter-item">
              <label className={`filter-label ${activeFilters[disease] ? 'active-filter' : ''}`}>
                <span className="filter-label-text">{disease}</span>
                {/* Display count if greater than 0 */}
                {count > 0 && <span className="filter-count">({count})</span>}
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
          );
        })}
      </div>
    </div>
  );
}

export default FilterPanel;
