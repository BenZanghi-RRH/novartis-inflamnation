import { useState, useEffect } from 'react';
import * as topojson from 'topojson-client';
import { geoCentroid } from 'd3-geo';
import Supercluster from 'supercluster';

const COUNTY_DATA_URL = '/counties-10m.json'; // Assuming it's in the public folder
const TESTIMONIAL_DATA_URL = '/data-2.json'; // UPDATED data source

// Define the target classification categories used in data-2.json
// Exclude 'Other' as it's usually not a filter option.
const TARGET_CLASSIFICATIONS = [
  'Ankylosing Spondylitis',
  'Hidradenitis Suppurativa',
  'Plaque Psoriasis',
  'Psoriatic Arthritis',
  'Breast Cancer',
  'Heart Disease',
  "Sjögren's Syndrome",
  // 'Other' - Typically excluded from filters
];

// Removed normalizeDiseaseName function as classification is pre-computed

export function useData() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [testimonialData, setTestimonialData] = useState(null);
  const [clusterIndex, setClusterIndex] = useState(null);
  const [diseaseTypes, setDiseaseTypes] = useState([]);
  const [activeFilters, setActiveFilters] = useState({});
  const [filteredData, setFilteredData] = useState(null);
  const [filteredClusterIndex, setFilteredClusterIndex] = useState(null);
  const [classificationCounts, setClassificationCounts] = useState({}); // State for counts

  // Initialize data and extract disease types
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch both datasets in parallel
        const [countyResponse, testimonialResponse] = await Promise.all([
          fetch(COUNTY_DATA_URL),
          fetch(TESTIMONIAL_DATA_URL),
        ]);

        if (!countyResponse.ok) {
          throw new Error(`Failed to fetch county data: ${countyResponse.statusText}`);
        }
        if (!testimonialResponse.ok) {
          throw new Error(`Failed to fetch testimonial data: ${testimonialResponse.statusText}`);
        }

        const countyTopoJson = await countyResponse.json();
        const testimonialData = await testimonialResponse.json();

        // --- Process County Data ---
        // Assuming the TopoJSON file has an object named 'counties'
        const countiesGeoJson = topojson.feature(countyTopoJson, countyTopoJson.objects.counties);
        const countyCentroids = {};
        countiesGeoJson.features.forEach(feature => {
          const fips = feature.id; // Assuming the feature id is the FIPS code
          if (fips) {
            const centroid = geoCentroid(feature);
            // Filter out invalid centroids (e.g., for territories outside projection)
            if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
              countyCentroids[fips] = centroid; // [longitude, latitude]
            } else {
              console.warn(`Could not calculate centroid for FIPS: ${fips}`);
            }
          }
        });

        // --- Process Testimonial Data for Clustering ---
        const points = [];
        const classificationCountMap = {}; // Use classification instead of disease

        // Initialize classification count map
        TARGET_CLASSIFICATIONS.forEach(classification => {
          classificationCountMap[classification] = 0;
        });
        // Add 'Other' manually if we want to track it, though it might not be filterable
        classificationCountMap['Other'] = 0;

        Object.values(testimonialData).forEach((countyInfo, index) => {
          const fips = countyInfo.county;
          const coordinates = countyCentroids[fips];

          if (coordinates) {
            const processVerbatims = (verbatims, sentiment) => {
              if (verbatims && Array.isArray(verbatims)) {
                verbatims.forEach((item, testimonialIndex) => {
                  // Use the pre-computed classification field
                  const classification = item.classification || 'Other'; // Default to 'Other' if missing

                  // Count occurrences of each classification (using safer hasOwnProperty check)
                  if (Object.prototype.hasOwnProperty.call(classificationCountMap, classification)) {
                     classificationCountMap[classification]++;
                  } else {
                     // This case shouldn't happen if classification script worked correctly
                     // but good to handle. Maybe add to 'Other'?
                     classificationCountMap['Other']++;
                     console.warn(`Unexpected classification found: ${classification}`);
                  }

                  points.push({
                    type: 'Feature',
                    properties: {
                      cluster: false,
                      testimonialId: `${fips}-${index}-${testimonialIndex}`,
                      category: sentiment === 'positive' ? 'positive' : 'negative',
                      disease: classification, // Use classification here (consistent naming)
                      text: item.nn_verbatim,
                      county: countyInfo.county_name,
                    },
                    geometry: {
                      type: 'Point',
                      coordinates: [
                        coordinates[0] + (Math.random() - 0.5) * 0.01,
                        coordinates[1] + (Math.random() - 0.5) * 0.01
                      ]
                    }
                  });
                });
              }
            };

            processVerbatims(countyInfo.positive_verbatim, 'positive');
            processVerbatims(countyInfo.negative_verbatim, 'negative');
          } else {
            console.warn(`No coordinates found for FIPS: ${fips}. Skipping testimonials for ${countyInfo.county_name}`);
          }
        });

        // Determine available classifications (excluding 'Other' for filtering)
        const availableClassifications = TARGET_CLASSIFICATIONS.filter(cls =>
          classificationCountMap[cls] > 0
        );

        // Initialize all filters to off by default
        const initialFilters = {};
        availableClassifications.forEach(cls => {
          initialFilters[cls] = false;
        });

        setGeoData(countiesGeoJson);
        setTestimonialData(points);
        setData(points); // Set the processed points as the main data
        setDiseaseTypes(availableClassifications); // Use classifications for filter types
        setActiveFilters(initialFilters);
        setClassificationCounts(classificationCountMap); // Store the counts

        // Initialize with empty filtered data since all filters are off by default
        setFilteredData([]);

        // --- Create Supercluster Index ---
        const index = new Supercluster({
          radius: 40,
          maxZoom: 16,
          minZoom: 0,
        });
        index.load(points);
        setClusterIndex(index);
        
        // Create an empty cluster index for initial state (no filters active)
        const emptyIndex = new Supercluster({
          radius: 40,
          maxZoom: 16,
          minZoom: 0,
        });
        emptyIndex.load([]);
        setFilteredClusterIndex(emptyIndex);

        console.log('Data loaded and processed for clustering from data-2.json.');
        console.log('Formatted points:', points.length);
        console.log('Available classifications for filtering:', availableClassifications);
        console.log('Classification counts:', classificationCountMap);
        console.log('Cluster index created:', index);

      } catch (err) {
        console.error("Error loading data:", err);
        setError(err.message || 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Apply filters when they change
  useEffect(() => {
    if (!testimonialData) return;

    // Check if any filters are active
    const anyFilterActive = Object.values(activeFilters).some(isActive => isActive);
    
    // If no filters are active, show no data
    if (!anyFilterActive) {
      setFilteredData([]);
      
      // Create empty cluster index
      const emptyIndex = new Supercluster({
        radius: 40,
        maxZoom: 16,
        minZoom: 0,
      });
      emptyIndex.load([]);
      setFilteredClusterIndex(emptyIndex);
      console.log('No filters active, showing no data points');
      return;
    }
    
    // Filter data based on active classification filters
    const filtered = testimonialData.filter(point => {
      // point.properties.disease now holds the classification
      return activeFilters[point.properties.disease];
    });

    setFilteredData(filtered);

    // Create new cluster index with filtered data
    const index = new Supercluster({
      radius: 40,
      maxZoom: 16,
      minZoom: 0,
    });
    
    if (filtered.length > 0) {
      index.load(filtered);
    }
    setFilteredClusterIndex(index);

    console.log(`Filtered to ${filtered.length} points based on classification filters`);
  }, [testimonialData, activeFilters]);

  // Function to toggle a classification filter (rename variable for clarity)
  const toggleDiseaseFilter = (classification, isActive) => {
    setActiveFilters(prev => ({
      ...prev,
      [classification]: isActive // Key is the classification name
    }));
  };

  return { 
    data, 
    filteredData,
    isLoading, 
    error, 
    geoData, 
    testimonialData, 
    clusterIndex,
    filteredClusterIndex,
    diseaseTypes,
    activeFilters,
    toggleDiseaseFilter,
    classificationCounts // Return the counts
  };
}
