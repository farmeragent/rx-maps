# Farmer Management System - Next.js Demo

A Next.js application for field planning with Mapbox integration.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory and add your Mapbox token:
```
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- Interactive field dashboard
- Mapbox map integration with field-specific data
- Layer selection for yield targets, nutrient capacity, and nutrient requirements
- Responsive design with mobile support

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add the `NEXT_PUBLIC_MAPBOX_TOKEN` environment variable in Vercel project settings
4. Deploy

## Tech Stack

- Next.js 14
- React 18
- Mapbox GL JS
- TypeScript

