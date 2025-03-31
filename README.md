# Chronic Connections - Patient Experiences Map

An interactive visualization tool for mapping and exploring patient stories with chronic inflammatory conditions across the United States.

## Features

- Interactive map visualization using DeckGL and Mapbox
- Clustering of testimonials for efficient exploration
- Color-coded patient stories by disease type
- Detailed testimonial views with expandable content
- Filtering capabilities by disease type and location

## Technology Stack

- React
- Vite
- DeckGL for advanced visualization
- Mapbox GL for base map rendering
- Supercluster for efficient point clustering

## Getting Started

1. Clone the repository
```bash
git clone https://github.com/benpzanghi/novartis-inflamnation.git
cd novartis-inflamnation
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file in the root directory with your Mapbox API key:
```
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
```

4. Start the development server
```bash
npm run dev
```

## Usage

- Zoom and pan to explore the map
- Click on clusters to zoom in and see individual testimonials
- Click on individual points to read patient stories
- Use filters to narrow down by disease type or location
