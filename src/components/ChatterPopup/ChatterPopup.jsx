import React, { useState, useEffect, useRef } from 'react'; // Import useRef
import './ChatterPopup.css';

const STREAM_SPEED = 50; // Milliseconds per character
const DISPLAY_DURATION = 4000; // Milliseconds to show after streaming finishes
const FADE_OUT_DURATION = 500; // Matches CSS animation duration

function ChatterPopup({ testimonial, position }) { // Removed onComplete prop
  const [displayedText, setDisplayedText] = useState('');
  const [isFadingOut, setIsFadingOut] = useState(false); // State for fade-out
  const fullText = testimonial?.text || '';
  const indexRef = useRef(0);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  // Effect for streaming text using refs
  useEffect(() => {
    // Clear any existing intervals/timeouts from previous renders/testimonials
    clearInterval(intervalRef.current);
    clearTimeout(timeoutRef.current);
    setDisplayedText(''); // Reset text
    indexRef.current = 0; // Reset index

    setIsFadingOut(false); // Ensure not fading out initially
    setDisplayedText(''); // Reset text
    indexRef.current = 0; // Reset index

    if (!fullText) {
      console.log('ChatterPopup: fullText is empty or undefined.');
      return;
    }
    console.log('ChatterPopup received text:', fullText); // Log the text

    intervalRef.current = setInterval(() => {
      // console.log('Chatter interval running, index:', indexRef.current); // Log interval execution - Temporarily disable for less noise
      if (indexRef.current < fullText.length) {
        const nextChar = fullText[indexRef.current];
        setDisplayedText((prev) => prev + nextChar);
        indexRef.current++; // Increment ref index
      } else {
        // Text finished streaming
        console.log('ChatterPopup: Text streaming complete.'); // Add log here
        clearInterval(intervalRef.current);
        intervalRef.current = null; // Clear ref too
        // Set timeout to trigger fade-out after display duration
        timeoutRef.current = setTimeout(() => {
          console.log('ChatterPopup: Triggering fade out.'); // Add log here
          setIsFadingOut(true);
          // Optional: Could add another timeout to fully remove from DOM after fade-out,
          // but letting MapComponent replace it might be simpler.
        }, DISPLAY_DURATION);
      }
    }, STREAM_SPEED);

    console.log('ChatterPopup: setInterval called, ID:', intervalRef.current); // Log interval ID

    // Cleanup function for when the component unmounts or fullText changes
    return () => {
      console.log('ChatterPopup: Cleanup effect running. Clearing interval:', intervalRef.current, 'and timeout:', timeoutRef.current); // Log cleanup
      clearInterval(intervalRef.current);
      clearTimeout(timeoutRef.current);
    };
  }, [fullText]); // Removed onComplete from dependencies

  if (!testimonial || !position) {
    return null;
  }

  // Basic positioning - might need refinement based on bubble size
  const style = {
    left: `${position.x}px`,
    top: `${position.y}px`,
    // Add transform to center or offset based on final styling
    transform: 'translate(-50%, -110%)', // Example: offset above the point
  };

  // Determine if the cursor should be visible (only during streaming)
  const showCursor = indexRef.current < fullText.length;

  return (
    <div className={`chatter-popup ${isFadingOut ? 'fading-out' : ''}`} style={style}>
      <div className="chatter-bubble">
        {displayedText}
        {showCursor && <span className="typing-cursor">|</span>} {/* Conditionally render cursor */}
        {/* <span className="typing-cursor">|</span> Simple cursor - REMOVED DUPLICATE */}
      </div>
      <div className="chatter-tail"></div> {/* Triangle tail */}
    </div>
  );
}

export default ChatterPopup;
