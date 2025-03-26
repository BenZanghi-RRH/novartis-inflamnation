import React, { useState, useEffect, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { Map as ReactMapGLMap } from 'react-map-gl';
import { ScatterplotLayer } from '@deck.gl/layers';
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
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [clusteredData, setClusteredData] = useState([]);
  const [selectedTestimonial, setSelectedTestimonial] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);

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

  // Handle clicking on a cluster to zoom in
  const handleClick = (info) => {
    if (!info.object) {
      setSelectedTestimonial(null);
      return;
    }
    
    // If it's a cluster, zoom in
    if (info.object.properties.cluster) {
      setSelectedTestimonial(null); // Close any open testimonial
      
      const clusterId = info.object.properties.cluster_id;
      const [longitude, latitude] = info.object.geometry.coordinates;
      
      // Get the cluster expansion zoom level
      const expansionZoom = Math.min(
        filteredClusterIndex.getClusterExpansionZoom(clusterId),
        20 // Max zoom level
      );
      
      setViewState({
        ...viewState,
        longitude,
        latitude,
        zoom: expansionZoom,
        transitionDuration: 500,
        transitionInterpolator: null
      });
    } else {
      // Show testimonial
      const testimonialData = {
        ...info.object.properties,
        coordinates: info.object.geometry.coordinates
      };
      console.log('Clicked on testimonial:', testimonialData);
      setSelectedTestimonial(testimonialData);
    }
  };

  // Close testimonial when clicking outside
  const handleMapClick = (event) => {
    // Check if click was on the map and not on a point
    if (!event.pickInfo?.object) {
      setSelectedTestimonial(null);
    }
  };

  // Handle hover events
  const handleHover = (info) => {
    if (info.object) {
      setHoverInfo({
        object: info.object,
        x: info.x,
        y: info.y
      });
    } else {
      setHoverInfo(null);
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
      lineWidthMinPixels: 1,
      getPosition: d => d.geometry.coordinates,
      getRadius: d => {
        // Size based on the number of points in the cluster
        if (d.properties.cluster) {
          return Math.min(
            POINT_SIZES.CLUSTER.BASE + (d.properties.point_count * 500), 
            50000
          );
        }
        return POINT_SIZES.CLUSTER.BASE;
      },
      getFillColor: () => [41, 121, 255, 180], // Blue for all clusters
      getLineColor: [255, 255, 255],
      getLineWidth: 2,
      onClick: handleClick,
      onHover: handleHover,
      updateTriggers: {
        getFillColor: [activeFilters]
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
      return [clusterLayer, testimonialLayer];
    } else {
      // At lower zoom levels, primarily show clusters
      return [clusterLayer, testimonialLayer];
    }
  }, [clusteredData, activeFilters, showDetailedView, handleClick, handleHover]);

  // Render custom hover tooltip
  const renderTooltip = () => {
    if (!hoverInfo) return null;
    
    const { object, x, y } = hoverInfo;
    const { properties } = object;
    
    if (properties.cluster) {
      // Tooltip for clusters
      return (
        <div className="tooltip" style={{ left: x, top: y }}>
          <div className="tooltip-title">Patient Stories</div>
          <div className="tooltip-count">{properties.point_count} testimonials</div>
          <div className="tooltip-hint">Click to explore</div>
        </div>
      );
    } else {
      // Tooltip for individual testimonials
      return (
        <div className="tooltip" style={{ left: x, top: y }}>
          <div className="tooltip-title">{properties.disease}</div>
          <div className="tooltip-preview">
            {properties.text ? properties.text.substring(0, 60) + '...' : 'No text available'}
          </div>
          <div className="tooltip-location">{properties.county}</div>
        </div>
      );
    }
  };

  // Calculate the position for a testimonial
  const getTestimonialPosition = () => {
    if (!selectedTestimonial) return null;
    
    const [x, y] = selectedTestimonial.coordinates;
    return {
      left: `calc(50% + ${(x - viewState.longitude) * 100}px)`,
      top: `calc(50% - ${(y - viewState.latitude) * 100}px)`
    };
  };
  
  return (
    <div className="map-container">
      <DeckGL
        initialViewState={viewState}
        viewState={viewState} 
        controller={true}
        layers={layers}
        style={{ position: 'relative', width: '100%', height: '100%' }}
        onViewStateChange={({ viewState }) => setViewState(viewState)}
        onClick={handleMapClick}
      >
        {MAPBOX_ACCESS_TOKEN && (
          <ReactMapGLMap
            mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
            mapStyle="mapbox://styles/mapbox/dark-v10" // Switched to dark style to match concept image
          />
        )}
        {!MAPBOX_ACCESS_TOKEN && (
           <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'red', background: 'white', padding: '10px', border: '1px solid red' }}>
             Mapbox Access Token missing. Please configure VITE_MAPBOX_ACCESS_TOKEN in .env
           </div>
        )}
        {renderTooltip()}
      </DeckGL>
      
      {/* Render the testimonial using our component */}
      {selectedTestimonial && (
        <Testimonial 
          testimonial={selectedTestimonial}
          position={getTestimonialPosition()}
        />
      )}
    </div>
  );
}

export default MapComponent;
