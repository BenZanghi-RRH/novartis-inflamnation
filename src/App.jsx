import React from 'react';
import MapComponent from './components/Map/Map';
import FilterPanel from './components/FilterPanel/FilterPanel';
import StatisticsPanel from './components/StatisticsPanel/StatisticsPanel';
import { useData } from './hooks/useData';
import './App.css';

function App() {
  const { 
    isLoading, 
    error, 
    diseaseTypes, 
    activeFilters,
    toggleDiseaseFilter,
    filteredClusterIndex,
    filteredData, // Get the raw filtered points
    classificationCounts // Get the counts from the hook
  } = useData();

  if (isLoading) {
    return <div className="loading">Loading application data...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="app">
      <FilterPanel
        diseaseTypes={diseaseTypes}
        activeFilters={activeFilters}
        onToggleFilter={toggleDiseaseFilter}
        counts={classificationCounts} // Pass counts as a prop
      />
      <StatisticsPanel activeFilters={activeFilters} />
      <MapComponent
        filteredClusterIndex={filteredClusterIndex} // Keep for now, might remove later
        filteredData={filteredData} // Pass the raw filtered points
        activeFilters={activeFilters}
      />
    </div>
  );
}

export default App;
