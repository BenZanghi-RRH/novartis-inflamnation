import React, { useState, useEffect, useMemo, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { Map as ReactMapGLMap } from 'react-map-gl';
import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
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

function MapComponent({ filteredClusterIndex, activeFilters }) {
  const [viewState, setViewState] = useState({
    ...INITIAL_VIEW_STATE,
    transitionDuration: 2000, // Initial animation
    transitionInterpolator: new FlyToInterpolator(),
    transitionEasing: t => t * (2 - t)
  });
  const [clusteredData, setClusteredData] = useState([]);
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
  console.log("Map received filteredClusterIndex:", filteredClusterIndex);

  // Update clusters when viewport changes or clusterIndex is available
  useEffect(() => {
    if (filteredClusterIndex && viewState) {
      const zoom = Math.floor(viewState.zoom);
      try {
        const clusters = filteredClusterIndex.getClusters(
          [-180, -85, 180, 85], // World bounds as bbox
          zoom
        );
        console.log(`Generated ${clusters.length} clusters at zoom level ${zoom}.`);
        setClusteredData(clusters);
      } catch (error) {
        console.error("Error generating clusters:", error);
        setClusteredData([]);
      }
    } else {
      // Clear data if filteredClusterIndex is not available
      setClusteredData([]);
    }
  }, [filteredClusterIndex, viewState?.zoom, activeFilters]);
  
  // Cleanup function for hover timeouts
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
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
    
    // If it's a cluster, zoom in
    if (info.object.properties.cluster) {
      // Clear any testimonial
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
      
      const clusterId = info.object.properties.cluster_id;
      const [longitude, latitude] = info.object.geometry.coordinates;
      
      // Get the cluster expansion zoom level
      const expansionZoom = Math.min(
        filteredClusterIndex.getClusterExpansionZoom(clusterId),
        20 // Max zoom level
      );
      
      // Use FlyToInterpolator for smooth animation
      setViewState({
        ...viewState,
        longitude,
        latitude,
        zoom: expansionZoom,
        transitionDuration: 1000, // Duration in milliseconds (1 second)
        transitionInterpolator: new FlyToInterpolator(),
        transitionEasing: t => t * (2 - t) // Ease out function for smoother effect
      });
    } else {
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

  // Handle hover events
  const handleHover = (info) => {
    // We still need to clear any existing hover timeout for cleanup
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    // Clear any previous hover states on all objects
    clusteredData.forEach(d => {
      if (d.hoveredObject) {
        d.hoveredObject = false;
      }
    });
    
    // If there's an active hover testimonial showing, clear it
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
    
    // Set hover state on the current object if there is one
    if (info.object) {
      info.object.hoveredObject = true;
    }
  };

  // Determine if we should show clusters or individual points based on zoom level
  const showDetailedView = viewState.zoom >= ZOOM_THRESHOLD;

  const layers = useMemo(() => {
    console.log("Rebuilding layers with clusteredData length:", clusteredData.length);
    // Base cluster layer - shown at lower zoom levels
    const clusterLayer = new ScatterplotLayer({
      id: 'clusters',
      data: clusteredData.filter(d => d.properties.cluster),
      pickable: true,
      stroked: true,
      filled: true,
      radiusScale: 6,
      radiusMinPixels: POINT_SIZES.CLUSTER.MIN_PIXELS,
      radiusMaxPixels: POINT_SIZES.CLUSTER.MAX_PIXELS,
      lineWidthMinPixels: 2,
      getPosition: d => d.geometry.coordinates,
      getRadius: d => {
        // Size based on the number of points in the cluster
        // Enhanced sizing to better show the count text
        if (d.properties.cluster) {
          const count = d.properties.point_count;
          const logFactor = Math.log10(count + 1) * 1.5;
          
          // If hovered, slightly increase the size
          const hoverMultiplier = d.hoveredObject ? 1.1 : 1.0;
          
          return Math.min(
            (POINT_SIZES.CLUSTER.BASE + (count * 500 * logFactor)) * hoverMultiplier, 
            60000
          );
        }
        return POINT_SIZES.CLUSTER.BASE;
      },
      getFillColor: d => {
        // Slightly adjust opacity based on count for visual differentiation
        const baseAlpha = Math.min(180 + (d.properties.point_count || 0), 230);
        
        // If hovered, make the cluster more vibrant
        const alpha = d.hoveredObject ? Math.min(baseAlpha + 25, 255) : baseAlpha;
        const blueShift = d.hoveredObject ? 20 : 0; // Slight color shift on hover
        
        return [41, 121 + blueShift, 255, alpha]; // Blue for all clusters with dynamic opacity
      },
      getLineColor: d => {
        // Brighter border on hover
        return d.hoveredObject ? [255, 255, 255, 255] : [255, 255, 255, 200];
      },
      getLineWidth: d => {
        // Thicker border on hover
        return d.hoveredObject ? 3 : 2;
      },
      onClick: handleClick,
      onHover: info => {
        // Mark the object as hovered for visual feedback
        if (info.object) {
          info.object.hoveredObject = true;
        }
        handleHover(info);
      },
      updateTriggers: {
        getFillColor: [activeFilters, 'hoveredObject'],
        getRadius: [clusteredData, 'hoveredObject'],
        getLineColor: ['hoveredObject'],
        getLineWidth: ['hoveredObject']
      }
    });

    // Text layer to show count number inside clusters
    const clusterCountLayer = new TextLayer({
      id: 'cluster-counts',
      data: clusteredData.filter(d => d.properties.cluster),
      pickable: false,
      getPosition: d => d.geometry.coordinates,
      getText: d => d.properties.point_count.toString(),
      getSize: d => {
        // Adjusting text size based on count for better readability
        const count = d.properties.point_count;
        const digitCount = count.toString().length;
        
        // Base size that grows with digit count but not too large
        let size = 16;
        
        // Larger clusters need larger text, but with diminishing returns
        if (digitCount === 1) {
          size = 16; // Single digit
        } else if (digitCount === 2) {
          size = 18; // Double digits
        } else if (digitCount === 3) {
          size = 20; // Triple digits
        } else {
          size = 22; // Very large numbers
        }
        
        // Increase size slightly on hover
        if (d.hoveredObject) {
          size += 2;
        }
        
        return size;
      },
      getColor: d => {
        // Enhance text color on hover
        return d.hoveredObject ? [255, 255, 255, 255] : [255, 255, 255, 240];
      },
      getAngle: 0,
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'center',
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'bold',
      // Add a subtle shadow for better readability
      outlineWidth: d => d.hoveredObject ? 5 : 4,
      outlineColor: [0, 0, 0, 150],
      // Additional styling
      fontSettings: {
        sdf: true,
        fontSize: 24,
        buffer: 6
      },
      updateTriggers: {
        getSize: ['hoveredObject'],
        getColor: ['hoveredObject'],
        outlineWidth: ['hoveredObject']
      }
    });

    // Individual testimonial layer - speech bubbles with color coding by disease
    const testimonialLayer = new ScatterplotLayer({
      id: 'testimonials',
      data: clusteredData.filter(d => !d.properties.cluster),
      pickable: true,
      stroked: true,
      filled: true,
      radiusScale: 6,
      radiusMinPixels: POINT_SIZES.INDIVIDUAL.MIN_PIXELS,
      radiusMaxPixels: POINT_SIZES.INDIVIDUAL.MAX_PIXELS,
      lineWidthMinPixels: 1,
      getPosition: d => d.geometry.coordinates,
      getRadius: () => POINT_SIZES.INDIVIDUAL.BASE,
      getFillColor: d => getDiseaseColor(d.properties.disease),
      getLineColor: [255, 255, 255],
      getLineWidth: 1,
      onClick: handleClick,
      onHover: handleHover,
      updateTriggers: {
        getFillColor: [activeFilters]
      }
    });

    // Decide which layers to show based on zoom level
    if (showDetailedView) {
      // At higher zoom levels, show individual points and any remaining clusters
      return [clusterLayer, clusterCountLayer, testimonialLayer];
    } else {
      // At lower zoom levels, primarily show clusters and their counts
      return [clusterLayer, clusterCountLayer, testimonialLayer];
    }
  }, [clusteredData, activeFilters, showDetailedView, handleClick, handleHover]);

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
        getTooltip={({object}) => {
          if (!object) return null;
          
          // For clusters, show the count and any filter information
          if (object.properties.cluster) {
            const count = object.properties.point_count;
            return {
              html: `
                <div>
                  <strong>${count} testimonial${count !== 1 ? 's' : ''}</strong>
                  <div style="font-size: 12px; margin-top: 4px;">Click to explore</div>
                </div>
              `,
              style: {
                backgroundColor: 'rgba(30, 40, 50, 0.9)',
                color: 'white',
                fontSize: '14px',
                padding: '8px 12px',
                borderRadius: '4px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
                fontFamily: 'Arial, sans-serif'
              }
            };
          }
          // For individual testimonials, do not show a hover tooltip
          if (!object.properties.cluster) {
            return null; // Return null to disable tooltip for individual points
          }

          // Return null by default if neither cluster nor individual point logic applies (shouldn't happen)
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
