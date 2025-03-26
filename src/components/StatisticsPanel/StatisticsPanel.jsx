import React from 'react';
import './StatisticsPanel.css';

// Sample statistics data - in a real app, this would come from an API or data processing
const diseaseStats = {
  'Ankylosing Spondylitis': {
    prevalence: '1 in 200',
    description: 'people have ankylosing spondylitis.',
    regionalData: '325,000',
    regionalDescription: 'Americans are affected by AS.'
  },
  'Hidradenitis Suppurativa': {
    prevalence: '1 in 100',
    description: 'people in the U.S. are diagnosed with hidradenitis supperativa.',
    regionalData: '5023',
    regionalDescription: 'people in the northeast may have (HS).'
  },
  'Multiple Sclerosis': {
    prevalence: '1 in 330',
    description: 'people in the U.S. have multiple sclerosis.',
    regionalData: '1 million',
    regionalDescription: 'people live with MS worldwide.'
  },
  'Asthma': {
    prevalence: '1 in 13',
    description: 'Americans have asthma.',
    regionalData: '25 million',
    regionalDescription: 'Americans suffer from asthma.'
  },
  'Breast Cancer': {
    prevalence: '1 in 8',
    description: 'women will develop breast cancer in their lifetime.',
    regionalData: '3.8 million',
    regionalDescription: 'breast cancer survivors in the U.S.'
  },
  'Diabetes': {
    prevalence: '1 in 10',
    description: 'Americans have diabetes.',
    regionalData: '37.3 million',
    regionalDescription: 'Americans live with diabetes.'
  },
  'Heart Disease': {
    prevalence: '1 in 4',
    description: 'deaths in the U.S. are caused by heart disease.',
    regionalData: '697,000',
    regionalDescription: 'Americans die from heart disease each year.'
  },
  'Hypertension': {
    prevalence: '1 in 2',
    description: 'adults in the U.S. have hypertension.',
    regionalData: '116 million',
    regionalDescription: 'Americans have high blood pressure.'
  },
  'Migraine': {
    prevalence: '1 in 6',
    description: 'Americans experience migraines.',
    regionalData: '39 million',
    regionalDescription: 'Americans suffer from migraines.'
  },
  'Other': {
    prevalence: 'Millions',
    description: 'of Americans live with chronic health conditions.',
    regionalData: '6 in 10',
    regionalDescription: 'adults in the U.S. have a chronic disease.'
  }
};

// Default to show when no specific disease is selected
const defaultStats = {
  prevalence: 'Millions',
  description: 'of Americans live with chronic health conditions.',
  regionalData: '42%',
  regionalDescription: 'of US adults have multiple chronic conditions.'
};

function StatisticsPanel({ activeFilters }) {
  // Find the first active disease to show stats for
  const activeFilter = Object.entries(activeFilters).find(entry => entry[1]);
  const activeDisease = activeFilter ? activeFilter[0] : null;
  
  // Get stats for the active disease or use default
  const stats = activeDisease ? 
    (diseaseStats[activeDisease] || defaultStats) : 
    defaultStats;

  return (
    <div className="statistics-panel">
      <h2>Vital statistics</h2>
      <div className="stat-container">
        <div className="stat-highlight">{stats.prevalence}</div>
        <div className="stat-description">{stats.description}</div>
      </div>
      <div className="stat-divider"></div>
      <div className="stat-container">
        <div className="stat-highlight">{stats.regionalData}</div>
        <div className="stat-description">{stats.regionalDescription}</div>
      </div>
    </div>
  );
}

export default StatisticsPanel; 