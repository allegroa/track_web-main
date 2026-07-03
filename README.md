# RAMSYS Data Visualizer (Next.js)

Self-contained visualization microservice for WebOne. Runs separately from the main Vite frontend and talks to the WebOne backend API using a JWT passed from the host app.

## Development

```bash
cd dataviz_web
cp .env.example .env.local
npm install
npm run dev
```

Open: [http://localhost:3000?folder=upload&file=example.geo&token=YOUR_JWT](http://localhost:3000?folder=upload&file=example.geo&token=YOUR_JWT)

## Docker

```bash
docker compose up dataviz --build
```

Service URL: [http://localhost:3001](http://localhost:3001)

## Integration with WebOne

WebOne opens this service with query parameters:


| Param    | Description                                                       |
| -------- | ----------------------------------------------------------------- |
| `token`  | JWT from WebOne login (handed off once, stored in sessionStorage) |
| `folder` | Client folder path (e.g. `Taipei Metro/Track Geometry`)           |
| `file`   | File name to load                                                 |


Set in WebOne frontend `.env`:

```env
VITE_DATAVIZ_URL=http://localhost:3001
```

## Re-sync from WebOne monolith

If `DataVizualizer.jsx` changes in `frontend_webbone`, run:

```bash
node scripts/port-from-webone.js
```

