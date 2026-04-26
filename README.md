# Flight Diary

A 3D globe flight diary viewer. Visualize personal flight history with animated arcs, country heatmaps, and interactive stats.

![3D Globe](https://img.shields.io/badge/3D-Three.js%20Globe-6C5CE7) ![2D Map](https://img.shields.io/badge/2D-D3--geo-00D2A0)

## Features

- **3D globe** with great-circle flight arcs (Three.js + three-globe)
- **2D map** alternative (D3-geo equirectangular projection)
- **Country highlighting** — visited countries shown as heatmap (Natural Earth 110m)
- **Multi-user** — switch between people, each with their own flight CSV
- **Year filter** — filter flights by year
- **Focus mode** — click an airport, country, or airline to drill down
- **Stats dashboard** — flights, countries, airports, distance, airlines, aircraft types
- **Reason split** — leisure vs business breakdown
- **Tweaks panel** — color scheme (Ink/Aurora/Mesh), airport labels, compact sidebar

## Data Format

Flight CSVs follow the [OpenFlights](https://openflights.org/) export format:

```csv
Date,From,To,Flight_Number,Airline,Distance,Duration,Seat,Seat_Type,Class,Reason,Plane,Registration,Trip,Note
2024-08-15 09:30:00,JFK,LHR,BA178,British Airways,5539,07:10,22A,W,Y,L,Boeing 777-300ER,,,,
```

Key fields: `Date` (ISO), `From`/`To` (IATA codes), `Distance` (km), `Reason` (`L`=Leisure, `B`=Business, `O`=Other).

## Setup

1. **Quick start** — open `index.html` via a local server. Without config it loads `sample_tracker.csv`.

   ```sh
   python3 -m http.server 8080
   # open http://localhost:8080
   ```

2. **With your own data** — create `flights.json` next to `index.html`:

   ```json
   {
     "users": {
       "Alice": "path/to/alice_flights.csv",
       "Bob": "../bob_tracker.csv"
     }
   }
   ```

   Paths are relative to `index.html`. See `flights.json.example`.

3. `flights.json` is gitignored — your flight data stays private.

## Design Tokens

Built with a custom design system (`tokens.css`). Colors, typography, and spacing are defined as CSS custom properties and can be customized.

## Credits

- Globe rendering: [three-globe](https://github.com/vasturiano/three-globe)
- Country data: [Natural Earth](https://www.naturalearthdata.com/) via [world-atlas](https://github.com/topojson/world-atlas)
- Airport coordinates: [OpenFlights](https://openflights.org/data.html)
- Design system by Prasad Gupte
