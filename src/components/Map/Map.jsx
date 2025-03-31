import React, { useState, useEffect, useMemo, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { Map as ReactMapGLMap } from 'react-map-gl';
import { ScatterplotLayer } from '@deck.gl/layers'; // TextLayer removed
import { HeatmapLayer } from '@deck.gl/aggregation-layers'; // Import HeatmapLayer
import { FlyToInterpolator } from '@deck.gl/core';
import 'mapbox-gl/dist/mapbox-gl.css'; // Import Mapbox CSS
import './Map.css';
import { getDiseaseColor, POINT_SIZES } from '../../utils/diseaseMappings';
import Testimonial from '../Testimonial/Testimonial';

// Viewport settings centered on the US
const INITIAL_VIEW_STATE = {
  longitude: -98.5795,
  latitude: 39.8283,
  zoom: 3.5,
  pitch: 0,
  bearing: 0
};

// Mapbox Access Token from .env file
const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

if (!MAPBOX_ACCESS_TOKEN) {
  console.error("Mapbox Access Token is not set. Please add VITE_MAPBOX_ACCESS_TOKEN to your .env file.");
}

// Constants for controlling visualization
const ZOOM_THRESHOLD = 5; // Zoom level at which we switch from clusters to individual points
const ICON_ATLAS = '/icons/speech-bubble.svg'; // Path to the icon atlas
const ICON_MAPPING = {
  marker: {x: 0, y: 0, width: 24, height: 24, mask: true}
};

// Heatmap Color Range (Example: Blue to Red)
const HEATMAP_COLOR_RANGE = [
  [1, 152, 189],
  [73, 227, 206],
  [216, 254, 181],
  [254, 237, 177],
  [254, 173, 84],
  [209, 55, 78]
];

function MapComponent({ filteredData, activeFilters }) { // Use filteredData, remove filteredClusterIndex
  const [viewState, setViewState] = useState({
    ...INITIAL_VIEW_STATE,
    transitionDuration: 2000, // Initial animation
    transitionInterpolator: new FlyToInterpolator(),
    transitionEasing: t => t * (2 - t)
  });
  const [animationTime, setAnimationTime] = useState(0); // State for animation
  // const [clusteredData, setClusteredData] = useState([]); // No longer using clustered data directly for heatmap
  const [testimonialState, setTestimonialState] = useState({
    data: null,
    position: null,
    coordinates: null, // Geographic coordinates [longitude, latitude]
    isPreview: false,
    mode: null, // 'hover', 'full', or null
    uniqueId: null, // Used for keying
    isAtEdge: false, // Whether the testimonial is at the edge of the viewport
    edgeDirection: null // Direction to the off-screen point
  });
  
  // Refs for managing hover debounce and deck access
  const hoverTimeoutRef = useRef(null);
  const isTransitioningRef = useRef(false);
  const deckRef = useRef(null);

  // Debug information
  console.log("Map received active filters:", activeFilters);
  console.log("Map received filteredData count:", filteredData?.length);

  // // Update clusters when viewport changes or clusterIndex is available - REMOVED as we use raw data now
  // useEffect(() => {
  //   if (filteredClusterIndex && viewState) {
  //     const zoom = Math.floor(viewState.zoom);
  //     try {
  //       const clusters = filteredClusterIndex.getClusters(
  //         [-180, -85, 180, 85], // World bounds as bbox
  //         zoom
  //       );
  //       console.log(`Generated ${clusters.length} clusters at zoom level ${zoom}.`);
  //       setClusteredData(clusters);
  //     } catch (error) {
  //       console.error("Error generating clusters:", error);
  //       setClusteredData([]);
  //     }
  //   } else {
  //     // Clear data if filteredClusterIndex is not available
  //     setClusteredData([]);
  //   }
  // }, [filteredClusterIndex, viewState?.zoom, activeFilters]);
  
  // Cleanup function for hover timeouts
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Animation loop for heatmap intensity
  useEffect(() => {
    let animationFrameId;
    const animate = () => {
      setAnimationTime(Date.now());
      animationFrameId = requestAnimationFrame(animate);
    };
    animate(); // Start the animation
    return () => cancelAnimationFrame(animationFrameId); // Cleanup on unmount
  }, []);

  // Handle click on a testimonial to show the full testimonial
  const handleClick = (info) => {
    // Clear any pending hover timeouts
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    if (!info.object) {
      setTestimonialState({
        data: null,
        position: null,
        coordinates: null,
        isPreview: false,
        mode: null,
        uniqueId: null,
        isAtEdge: false,
        edgeDirection: null
      });
      return;
    }
    
    // If it's a cluster (ScatterplotLayer point), show testimonial
    // HeatmapLayer is not pickable by default, so this mainly applies if we keep the individual points layer
    if (info.layer.id === 'testimonials' && !info.object.properties.cluster) {
       // Show testimonial regardless of zoom level
       const testimonialData = {
         ...info.object.properties,
         coordinates: info.object.geometry.coordinates
       };
       console.log('Clicked on testimonial:', testimonialData);
       
       // Always use the mouse position for initial positioning
       const position = { x: info.x, y: info.y };
       
       // Display the full testimonial with a new unique ID to force re-render
       isTransitioningRef.current = true;
       setTestimonialState({
         data: testimonialData,
         position: position,
         coordinates: testimonialData.coordinates,
         isPreview: false,
         mode: 'full',
         uniqueId: `full-${Date.now()}`,
         isAtEdge: false,
         edgeDirection: null
       });
       
       // Clear transitioning flag after animation completes
       setTimeout(() => {
         isTransitioningRef.current = false;
       }, 300);

    } else {
       // Click was likely on the heatmap or empty space, clear testimonial
       setTestimonialState({
        data: null,
        position: null,
        coordinates: null,
        isPreview: false,
        mode: null,
        uniqueId: null,
        isAtEdge: false,
        edgeDirection: null
      });
    }
  };


  // Update testimonial position when map moves
  useEffect(() => {
    if (testimonialState.coordinates && testimonialState.data && deckRef.current) {
      const viewport = deckRef.current.deck.getViewports()[0];
      if (viewport) {
        // Project the geographic coordinates to screen coordinates
        const [x, y] = viewport.project(testimonialState.coordinates);
        
        // Check if the point is within the viewport
        const isVisible = 
          x >= 0 && x <= viewport.width && 
          y >= 0 && y <= viewport.height;
        
        if (isVisible) {
          // Update position if visible
          setTestimonialState(prevState => ({
            ...prevState,
            position: { x, y },
            isAtEdge: false
          }));
        } else if (testimonialState.mode === 'full') {
          // Keep testimonial at the edge of the screen
          // Calculate the closest point on the edge of the viewport
          const edgeX = Math.max(10, Math.min(x, viewport.width - 10));
          const edgeY = Math.max(10, Math.min(y, viewport.height - 10));
          
          // Determine the approximate direction to the off-screen point
          const direction = {
            top: y < 0,
            right: x > viewport.width,
            bottom: y > viewport.height,
            left: x < 0
          };
          
          setTestimonialState(prevState => ({
            ...prevState,
            position: { x: edgeX, y: edgeY },
            isAtEdge: true,
            edgeDirection: direction
          }));
        }
      }
    }
  }, [viewState, testimonialState.coordinates, testimonialState.data, testimonialState.mode]);

  // Close testimonial when clicking outside
  const handleMapClick = (event) => {
    // Check if click was on the map and not on a point
    if (!event.pickInfo?.object && testimonialState.data && testimonialState.mode === 'full') {
      setTestimonialState({
        data: null,
        position: null,
        coordinates: null,
        isPreview: false,
        mode: null,
        uniqueId: null,
        isAtEdge: false,
        edgeDirection: null
      });
    }
  };

  // Handle hover events (simplified as heatmap doesn't provide object info)
  const handleHover = () => { // Removed 'info' parameter
    // We still need to clear any existing hover timeout for cleanup
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    // // Clear any previous hover states on all objects - Not needed for heatmap
    // clusteredData.forEach(d => {
    //   if (d.hoveredObject) {
    //     d.hoveredObject = false;
    //   }
    // });
    
    // If there's an active hover testimonial showing, clear it (if we keep individual points)
    if (testimonialState.mode === 'hover') {
      setTestimonialState({
        data: null,
        position: null,
        coordinates: null,
        isPreview: false,
        mode: null,
        uniqueId: null,
        isAtEdge: false,
        edgeDirection: null
      });
    }
    
    // // Set hover state on the current object if there is one - Not applicable to heatmap
    // if (info.object) {
    //   info.object.hoveredObject = true;
    // }
  };

  // // Determine if we should show clusters or individual points based on zoom level - Not applicable for heatmap
  // const showDetailedView = viewState.zoom >= ZOOM_THRESHOLD;

  const layers = useMemo(() => {
    console.log("Rebuilding layers with filteredData length:", filteredData?.length);
    
    if (!filteredData) {
      return []; // Return empty array if data is not ready
    }

    // Heatmap Layer using the raw filtered points
    const heatmapLayer = new HeatmapLayer({
      id: 'heatmap',
      data: filteredData,
      getPosition: d => d.geometry.coordinates,
      getWeight: 1, // Each point contributes equally
      radiusPixels: 60, // Adjust for desired smoothness/spread
      // Animate intensity slightly
      intensity: 1 + Math.sin(animationTime * 0.0005) * 0.3, // Base intensity + oscillation
      threshold: 0.05, // Adjust density threshold
      colorRange: HEATMAP_COLOR_RANGE,
      // Optional: Debounce updates for performance on rapid filtering
      debounceTimeout: 50,
      aggregation: 'SUM' // Use SUM aggregation
    });

    // Individual testimonial layer - Keep for now, but might be obscured by heatmap
    // Consider making this visible only at higher zoom levels if kept
    const testimonialLayer = new ScatterplotLayer({
      id: 'testimonials',
      // data: clusteredData.filter(d => !d.properties.cluster), // Use filteredData directly
      data: filteredData, // Use the raw filtered points
      pickable: true, // Always pickable
      visible: true, // Always technically visible
      opacity: viewState.zoom >= 6 ? 0.8 : 0.05, // Low opacity when zoomed out, higher when zoomed in
      stroked: viewState.zoom >= 6, // Only stroke when clearly visible
      filled: true,
      radiusScale: 1, // Use radius in pixels directly
      // Adjust radius based on zoom - Further increased zoomed-out size
      radiusMinPixels: viewState.zoom >= 6 ? POINT_SIZES.INDIVIDUAL.MIN_PIXELS : 6, // Increased from 4
      radiusMaxPixels: viewState.zoom >= 6 ? POINT_SIZES.INDIVIDUAL.MAX_PIXELS : 7, // Increased from 5
      lineWidthMinPixels: 1,
      getPosition: d => d.geometry.coordinates,
      // Use getRadius for dynamic sizing based on zoom
      getRadius: viewState.zoom >= 6 ? POINT_SIZES.INDIVIDUAL.BASE : 6, // Increased from 4
      // getRadius: () => POINT_SIZES.INDIVIDUAL.BASE, // REMOVED duplicate static radius
      getFillColor: d => getDiseaseColor(d.properties.disease), // Color by disease
      getLineColor: [255, 255, 255],
      getLineWidth: 1,
      onClick: handleClick, // Allow clicking to show testimonial
      onHover: handleHover, // Basic hover handling (might not be needed)
      updateTriggers: {
        getFillColor: [activeFilters],
        // visible: [viewState.zoom], // No longer needed as always visible
        opacity: [viewState.zoom], // Trigger opacity update on zoom change
        getRadius: [viewState.zoom], // Trigger radius update on zoom change
        stroked: [viewState.zoom]
      },
      transitions: {
         opacity: 300, // Smooth fade transition
         getRadius: 300 // Smooth radius transition
      }
    });

    // Return the heatmap layer and potentially the testimonial layer
    return [heatmapLayer, testimonialLayer];

  }, [filteredData, activeFilters, viewState.zoom, handleClick, handleHover, animationTime]); // Add animationTime dependency

  return (
    <div className="map-container">
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        viewState={viewState} 
        controller={true}
        layers={layers}
        style={{ position: 'relative', width: '100%', height: '100%' }}
        onViewStateChange={({ viewState }) => setViewState(viewState)}
        onClick={handleMapClick}
        getCursor={({ isDragging, isHovering }) => 
          isHovering ? 'pointer' : isDragging ? 'grabbing' : 'grab'
        }
        ref={deckRef}
        getTooltip={({object, layer}) => { // Check layer ID
          if (!object || !layer) return null;
          
          // Tooltip only for individual testimonial points when visible
          if (layer.id === 'testimonials' && !object.properties.cluster) {
             // Maybe show disease name on hover? Or nothing?
             // For now, disable tooltip for individual points as well, click shows full testimonial
             return null; 
            // return {
            //   text: `${object.properties.disease}`,
            //   style: { /* Optional styling */ }
            // };
          }
          
          // No tooltip for heatmap layer
          return null;
        }}
      >
        {MAPBOX_ACCESS_TOKEN && (
          <ReactMapGLMap
            mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
            mapStyle="mapbox://styles/bzanghi/cm8xgfnvs002t01s2apel8odq" // Updated to new custom style
          />
        )}
        {!MAPBOX_ACCESS_TOKEN && (
           <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'red', background: 'white', padding: '10px', border: '1px solid red' }}>
             Mapbox Access Token missing. Please configure VITE_MAPBOX_ACCESS_TOKEN in .env
           </div>
        )}
      </DeckGL>
      
      {/* Unified Testimonial Component with key prop to force re-render */}
      {testimonialState.data && (
        <Testimonial 
          key={testimonialState.uniqueId}
          testimonial={testimonialState.data}
          position={testimonialState.position}
          isAtEdge={testimonialState.isAtEdge}
          edgeDirection={testimonialState.edgeDirection}
        />
      )}
    </div>
  );
}

export default MapComponent;
