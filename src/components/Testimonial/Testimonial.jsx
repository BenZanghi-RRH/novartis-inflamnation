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

function Testimonial({ testimonial, position, isAtEdge, edgeDirection }) {
  const [expanded, setExpanded] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // Reset expanded state when testimonial changes
  useEffect(() => {
    setExpanded(false);
    setTransitioning(false);
  }, [testimonial]);

  // Debug log to see the testimonial data structure
  useEffect(() => {
    console.log('Testimonial component received:', testimonial, 'position:', position, 'isAtEdge:', isAtEdge);
  }, [testimonial, position, isAtEdge]);

  if (!testimonial) return null;

  // Handle expand/collapse toggle for read more/less
  const toggleExpanded = (e) => {
    e.stopPropagation(); // Prevent event from bubbling up to the map
    
    setTransitioning(true);
    setExpanded(!expanded);
    // Remove transitioning state after animation completes
    setTimeout(() => setTransitioning(false), 300);
  };

  // Sanitize and prepare testimonial text
  const rawText = testimonial.text || testimonial.nn_verbatim || '';
  const fullText = sanitizeText(rawText);
  
  // Determine if the testimonial text needs expansion
  const needsExpansion = fullText.length > TESTIMONIAL_PREVIEW_LENGTH;
  const displayText = expanded || !needsExpansion 
    ? fullText 
    : fullText.substring(0, TESTIMONIAL_PREVIEW_LENGTH) + '...';
  
  // Determine appropriate CSS classes
  const bubbleClassName = `testimonial-bubble ${expanded ? 'expanded' : ''} ${transitioning ? 'transitioning' : ''} ${isAtEdge ? 'at-edge' : ''}`;

  // Get appropriate disease color
  const diseaseColor = getDiseaseColor(testimonial.disease);
  const textColor = `rgba(${diseaseColor.slice(0, 3).join(',')}, 1)`;

  // Helper to safely get position values with fallbacks
  const getPositionStyle = () => {
    // Base position object
    const style = {
      position: 'absolute',
      zIndex: 100,
    };
    
    // Position provided as x,y coordinates (from mouse position)
    if (position && (position.x !== undefined && position.y !== undefined)) {
      return {
        ...style,
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)'
      };
    }
    
    // Position provided as left,top CSS values
    if (position && (position.left !== undefined && position.top !== undefined)) {
      return {
        ...style,
        left: position.left,
        top: position.top,
        transform: 'translate(0, -100%)'
      };
    }
    
    // Fallback position
    return {
      ...style,
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -100%)'
    };
  };

  return (
    <div 
      className={bubbleClassName}
      style={getPositionStyle()}
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
            style={{ color: textColor }}
          >
            {testimonial.disease}
          </span>
          <span className="testimonial-location">{testimonial.county}</span>
        </div>
        
        {isAtEdge && edgeDirection && (
          <div className="edge-indicator">
            Point is off-screen 
            {edgeDirection.top && ' ↑'}
            {edgeDirection.right && ' →'}
            {edgeDirection.bottom && ' ↓'}
            {edgeDirection.left && ' ←'}
          </div>
        )}
      </div>
      <div className="testimonial-arrow"></div>
    </div>
  );
}

export default Testimonial; 