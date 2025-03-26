import React, { useState, useEffect } from 'react';
import './Testimonial.css';
import { getDiseaseColor } from '../../utils/diseaseMappings';

// Preview length for testimonials
const TESTIMONIAL_PREVIEW_LENGTH = 150;

// Function to clean/sanitize text
const sanitizeText = (text) => {
  if (!text) return '';
  
  // Replace escaped quotes and other common issues
  return text
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\n/g, '\n')
    .trim();
};

function Testimonial({ testimonial, position }) {
  const [expanded, setExpanded] = useState(false);

  // Debug log to see the testimonial data structure
  useEffect(() => {
    console.log('Testimonial component received:', testimonial);
  }, [testimonial]);

  if (!testimonial) return null;

  // Handle expand/collapse toggle
  const toggleExpanded = (e) => {
    e.stopPropagation(); // Prevent event from bubbling up to the map
    setExpanded(!expanded);
  };

  // Sanitize and prepare testimonial text
  const rawText = testimonial.text || testimonial.nn_verbatim || '';
  const fullText = sanitizeText(rawText);
  
  // Determine if the testimonial text needs expansion
  const needsExpansion = fullText.length > TESTIMONIAL_PREVIEW_LENGTH;
  const displayText = expanded 
    ? fullText 
    : (needsExpansion ? fullText.substring(0, TESTIMONIAL_PREVIEW_LENGTH) + '...' : fullText);
  
  return (
    <div 
      className={`testimonial-bubble ${expanded ? 'expanded' : ''}`}
      style={{
        position: 'absolute',
        zIndex: 100,
        left: position.left,
        top: position.top,
        transform: 'translate(-50%, -100%)'
      }}
      onClick={(e) => e.stopPropagation()} // Prevent clicks from closing the testimonial
    >
      <div className="testimonial-content">
        <div className="testimonial-text">{displayText}</div>
        
        {needsExpansion && (
          <button 
            className="testimonial-expand-button"
            onClick={toggleExpanded}
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
        
        <div className="testimonial-info">
          <span 
            className="testimonial-disease"
            style={{ 
              color: `rgba(${getDiseaseColor(testimonial.disease).slice(0, 3).join(',')}, 1)` 
            }}
          >
            {testimonial.disease}
          </span>
          <span className="testimonial-location">{testimonial.county}</span>
        </div>
      </div>
      <div className="testimonial-arrow"></div>
    </div>
  );
}

export default Testimonial; 