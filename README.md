# Travel Diary

A 3D globe travel diary viewer. Visualize personal flight history with animated arcs, country heatmaps, and interactive stats.

![3D Globe](https://img.shields.io/badge/3D-Three.js%20Globe-6C5CE7) ![2D Map](https://img.shields.io/badge/2D-D3--geo-00D2A0)

## Features

- **3D globe** with great-circle flight arcs (Three.js + three-globe)
- **2D map** alternative (D3-geo equirectangular projection)
- **Country tracking** — countries visited per family member (from CSV)
- **Country highlighting** — visited countries shown as heatmap (Natural Earth 110m)
- **Multi-user** — switch between people, each with their own flight CSV
- **Year filter** — dropdown year selector
- **Autocomplete filters** — filter by airline, airport, country, or aircraft type
- **Arc coloring** — color by travel reason (leisure/business) or by airline
- **Focus mode** — click an airport, country, airline, or route to drill down
- **Stats dashboard** — flights, countries, airports, distance, airlines, aircraft types
- **Clickable stats** — click any stat card to see a detailed list view
- **Flight highlight** — click a flight to highlight its arc on the map
- **Resizable sidebar** — hide/show and drag to resize the stats pane
- **Zoom controls** — zoom buttons and scroll-zoom in both 3D and 2D views
- **Country flags** — flag emoji in tooltips, filter pills, and lists
- **Tweaks panel** — color scheme (Ink/Aurora/Mesh), airport labels

## Data Format

### Flight CSVs

Flight CSVs follow the [OpenFlights](https://openflights.org/) export format:

```csv
Date,From,To,Flight_Number,Airline,Distance,Duration,Seat,Seat_Type,Class,Reason,Plane,Registration,Trip,Note
2024-08-15 09:30:00,JFK,LHR,BA178,British Airways,5539,07:10,22A,W,Y,L,Boeing 777-300ER,,,,
```

Key fields: `Date` (ISO), `From`/`To` (IATA codes), `Distance` (km), `Reason` (`L`=Leisure, `B`=Business, `O`=Other).

### Countries CSV

`data/countries.csv` tracks countries visited per family member (semicolon-delimited):

```csv
country;iso;alice;bob
France;FR;2019;2020
Japan;JP;2023;
```

Columns after `iso` are member IDs. Values are the year of first visit.

## Setup

1. **Quick start** — open `index.html` via a local server. Without config it loads `sample_tracker.csv`.

   ```sh
   python3 -m http.server 8080
   # open http://localhost:8080
   ```

2. **With your own data** — create a `data/` folder and `flights.json`:

   ```json
   {
     "users": {
       "Alice": "data/alice_flights.csv",
       "Bob": "data/bob_flights.csv"
     }
   }
   ```

   Add your countries CSV as `data/countries.csv`.

3. `flights.json` and `data/` are gitignored — your travel data stays private.

## Design Tokens

Built with a custom design system (`tokens.css`). Colors, typography, and spacing are defined as CSS custom properties.

## Credits

- Globe rendering: [three-globe](https://github.com/vasturiano/three-globe)
- Country data: [Natural Earth](https://www.naturalearthdata.com/) via [world-atlas](https://github.com/topojson/world-atlas)
- Airport coordinates: [OpenFlights](https://openflights.org/data.html)
- Design system by Prasad Gupte
