import { useState, useEffect } from 'react';
import * as topojson from 'topojson-client';
import { geoCentroid } from 'd3-geo';
import Supercluster from 'supercluster';

const COUNTY_DATA_URL = '/counties-10m.json'; // Assuming it's in the public folder
const TESTIMONIAL_DATA_URL = '/data.json'; // Assuming it's in the public folder

// Define the target disease list with normalized names
const TARGET_DISEASES = [
  'Ankylosing Spondylitis',
  'Hidradenitis Suppurativa',
  'Multiple Sclerosis',
  'Asthma',
  'Breast Cancer',
  'Diabetes',
  'Heart Disease',
  'Hypertension',
  'Migraine'
];

// Helper function to normalize and map disease names to target diseases
function normalizeDiseaseName(diseaseName) {
  if (!diseaseName) return 'Unknown condition';
  
  const name = diseaseName.trim().toLowerCase();
  
  // Map similar or partial matches to the target disease names
  if (name.includes('ankylos') || name.includes('spondyl')) return 'Ankylosing Spondylitis';
  if (name.includes('hidra') || name.includes('suppura')) return 'Hidradenitis Suppurativa';
  if (name.includes('multiple') || name.includes('ms') || name.includes('sclerosis')) return 'Multiple Sclerosis';
  if (name.includes('asthma')) return 'Asthma';
  if (name.includes('breast') && name.includes('cancer')) return 'Breast Cancer';
  if (name.includes('diabet') || name.includes('type 1') || name.includes('type 2')) return 'Diabetes';
  if (name.includes('heart') || name.includes('cardiac') || name.includes('cardiovascular')) return 'Heart Disease';
  if (name.includes('hypert') || name.includes('blood pressure') || name.includes('hbp')) return 'Hypertension';
  if (name.includes('migraine') || name.includes('headache')) return 'Migraine';
  
  // If no match is found, return "Other"
  return 'Other';
}

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
        const diseaseCountMap = {};
        
        // Initialize disease count map with target diseases
        TARGET_DISEASES.forEach(disease => {
          diseaseCountMap[disease] = 0;
        });
        
        Object.values(testimonialData).forEach((countyInfo, index) => {
          const fips = countyInfo.county;
          const coordinates = countyCentroids[fips];

          if (coordinates) {
            const processVerbatims = (verbatims, sentiment) => {
              if (verbatims && Array.isArray(verbatims)) {
                verbatims.forEach((item, testimonialIndex) => {
                  // Normalize disease name to match target list
                  const normalizedDisease = normalizeDiseaseName(item.disease);
                  
                  // Count occurrences of each disease
                  if (TARGET_DISEASES.includes(normalizedDisease)) {
                    diseaseCountMap[normalizedDisease] = (diseaseCountMap[normalizedDisease] || 0) + 1;
                  }
                  
                  points.push({
                    type: 'Feature',
                    properties: {
                      cluster: false,
                      testimonialId: `${fips}-${index}-${testimonialIndex}`,
                      category: sentiment === 'positive' ? 'positive' : 'negative',
                      disease: normalizedDisease,
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

        // Only include target diseases that have data points
        const availableDiseases = TARGET_DISEASES.filter(disease => 
          diseaseCountMap[disease] > 0
        );
        
        // Initialize all filters to off by default
        const initialFilters = {};
        availableDiseases.forEach(disease => {
          initialFilters[disease] = false;
        });

        setGeoData(countiesGeoJson);
        setTestimonialData(points);
        setData(points); // Set the processed points as the main data
        setDiseaseTypes(availableDiseases);
        setActiveFilters(initialFilters);
        
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

        console.log('Data loaded and processed for clustering.');
        console.log('Formatted points:', points.length);
        console.log('Available diseases:', availableDiseases);
        console.log('Disease counts:', diseaseCountMap);
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
    
    // Filter data based on active disease filters
    const filtered = testimonialData.filter(point => {
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
    
    console.log(`Filtered to ${filtered.length} points based on disease filters`);
  }, [testimonialData, activeFilters]);

  // Function to toggle a disease filter
  const toggleDiseaseFilter = (disease, isActive) => {
    setActiveFilters(prev => ({
      ...prev,
      [disease]: isActive
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
    toggleDiseaseFilter
  };
}
