# Deep Search Usage Dashboard

A simple web app to surface Deep Search usage data from BigQuery for customers and their organizations.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Ensure you're authenticated with GCP:
```bash
gcloud auth application-default login
```

3. Start the server:
```bash
npm start
```

4. Open http://localhost:3000

## Features

- **Organizations Tab**: View all organizations using Deep Search with total searches, unique users, and activity dates
- **Users Tab**: Drill down into specific organizations to see individual user usage
- **Overages Tab**: View allocation vs actual usage and overages by organization
- **Event Breakdown**: See all Deep Search event types and their frequencies

## Data Sources

- `telligentsourcegraph.telemetry.v2_events` - Detailed Deep Search event telemetry
- `telligentsourcegraph.sourcegraph_analytics.ELA_deep_search_overages` - Overage tracking data

## API Endpoints

- `GET /api/org-usage?days=30` - Organization-level usage aggregation
- `GET /api/user-usage?org={url}&days=30` - User-level usage for a specific org
- `GET /api/overages` - Overage data from analytics table
- `GET /api/events-breakdown?org={url}&days=7` - Event type breakdown
