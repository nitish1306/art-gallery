# Art Gallery

A self-hosted 3D virtual art gallery built with Three.js. Walk through rooms, view artworks on walls with frames and spotlights, and manage everything from an admin panel.

## Features

- **3D gallery** with first-person WASD + mouse controls (desktop) or touch controls (mobile)
- **Multiple rooms** connected via archways, with partition walls
- **Artwork display** with frames, placards, spotlights, and click-to-view detail modal
- **Admin panel** for managing artworks, room layouts, textures, lighting, and audio
- **Automatic image processing** (trim, normalize, resize, thumbnail generation)
- **Adaptive quality** system that adjusts render quality based on device capabilities
- **HUD** with FPS counter and minimap
- **Mobile support** with configurable control modes (joystick + drag, joystick + gyro, tap + drag)
- **Ambient audio** with volume controls
- **Theming** -- customize wall/floor/ceiling textures, spotlight colors, ambient lighting

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later

## Setup

```bash
# Install dependencies
npm install

# Start the API server (port 3456)
npm start

# In a second terminal, start the dev server (port 3000)
npm run gallery
```

Open http://localhost:3000 for the gallery and http://localhost:3000/admin/ for the admin panel.

## Usage

### Gallery

1. Press **Enter** or tap to enter the gallery
2. **WASD** / arrow keys to move, **mouse** to look around, **Shift** to run
3. **Click** on an artwork to view details
4. Minimap (top-right) shows your position and room layout

### Admin Panel

#### Artworks Tab
- Drag and drop images to upload
- Fill in title, date, medium, description
- Choose room and wall placement
- Edit or delete existing artworks

#### Rooms Tab
- Change room size templates (small/medium/large)
- Set connections between rooms
- Add or delete rooms
- Set the spawn point
- 2D preview shows the layout

#### Theme Tab
- Change gallery name
- Pick wall, floor, and ceiling textures
- Adjust ambient and spotlight lighting (color, intensity, angle)
- Set default audio volume

## Project Structure

```
art-gallery/
  admin/
    index.html           # Admin panel HTML
  data/
    artworks.json        # Artwork metadata
    gallery.json         # Room layout and connections
    settings.json        # Theme, lighting, audio settings
  public/
    assets/
      artworks/          # Uploaded artwork images and thumbnails
      textures/          # Wall/floor/ceiling texture images
      audio/             # Background music tracks
  server/
    index.js             # Express API server
    routes/
      admin.js           # Admin CRUD endpoints
      gallery.js         # Read-only gallery data endpoints
    services/
      imageProcessor.js  # Sharp-based image processing
  src/
    admin/
      artworkManager.js  # Upload and manage artworks
      roomEditor.js      # Room layout editor
      themeManager.js    # Theme and settings editor
      tabs.js            # Tab navigation
      toast.js           # Toast notifications
      admin.css          # Admin styles
    gallery/
      main.js            # Entry point, scene setup, render loop
      roomBuilder.js     # 3D room construction from JSON
      controls.js        # Desktop WASD + mouse controls
      mobileControls.js  # Touch joystick and drag controls
      artworkLoader.js   # Loads and places artwork meshes
      lighting.js        # Ambient, hemisphere, and spotlights
      interaction.js     # Artwork click/hover interaction
      quality.js         # Adaptive quality system
      hud.js             # FPS counter and minimap
      audio.js           # Background audio player
      gallery.css        # Gallery styles
  index.html             # Gallery entry HTML
  vite.config.js         # Vite dev server and build config
  package.json
```

## Customization

### Adding textures

Place `.jpg` images in `public/assets/textures/`. They will appear automatically in the admin theme picker.

### Adding audio tracks

Place audio files in `public/assets/audio/`. Update `data/settings.json` to reference the track path.

### Room templates

Room sizes can be changed in the admin panel. For custom partition walls, edit `data/gallery.json` directly -- partitions use `{ axis, offset, wallStart, wallEnd }` format.

## Build for Production

```bash
npm run build
```

The built files will be in the `dist/` folder. In production the Express server serves both the API and the built frontend — no separate static file server needed:

```bash
NODE_ENV=production node server/index.js
```

---

## Deploying to Fly.io

[Fly.io](https://fly.io) is the recommended hosting platform. It runs a real Node.js container (required for `sharp` image processing and `multer` file uploads), offers a **free persistent volume** for uploaded data, and restarts from sleep in **2–5 seconds**.

### Prerequisites

Install the Fly CLI:

```bash
# Windows (PowerShell)
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"

# macOS / Linux
curl -L https://fly.io/install.sh | sh
```

Then sign up / log in:

```bash
fly auth signup    # or: fly auth login
```

### Step 1 — Launch the app

From the project root:

```bash
fly launch
```

When prompted:
- **App name**: `art-gallery` (or any name)
- **Region**: pick the closest to you (e.g. `iad` for US East, `lhr` for London)
- **Would you like to set up a Postgresql database?**: No (for now)
- **Would you like to set up an Upstash Redis database?**: No

This detects the existing `fly.toml` and `Dockerfile` in the repo.

### Step 2 — Create a persistent volume

```bash
fly volumes create gallery_data --size 1 --region iad
```

> Replace `iad` with your chosen region. The 1GB volume is free.

The volume name `gallery_data` matches the `[mounts]` section in `fly.toml`.

### Step 3 — Deploy

```bash
fly deploy
```

This builds the Docker image, pushes it, and starts the app. On first boot, `start.sh` seeds the volume with default JSON config and bundled textures.

### Fly.io Configuration Reference

All config is in `fly.toml`:

| Setting | Value | Purpose |
|---------|-------|---------|
| `primary_region` | `iad` | Deploy region |
| `NODE_ENV` | `production` | Enables static file serving from `dist/` |
| `DATA_DIR` | `/data` | Points server to persistent volume |
| `PORT` | `8080` | Internal port Fly routes traffic to |
| `internal_port` | `8080` | Must match `PORT` |
| `auto_stop_machines` | `stop` | Sleeps after inactivity (free tier friendly) |
| `auto_start_machines` | `true` | Wakes on incoming request (~2–5s) |
| `min_machines_running` | `0` | Allows full sleep to save resources |
| Volume mount | `/data` | Persistent storage for JSON + uploads |

### What gets deployed

```
┌──────────────────────────────────────────────┐
│            Fly.io Machine (container)         │
│                                               │
│   Express server (server/index.js)            │
│   ├── /api/*            → API routes          │
│   ├── /assets/*         → Volume (/data)      │
│   ├── /admin/*          → dist/admin/         │
│   └── /*                → dist/index.html     │
│                                               │
│   Persistent Volume mounted at /data          │
│   ├── data/             → JSON config files   │
│   └── public/assets/    → Uploaded artworks   │
└──────────────────────────────────────────────┘
```

### Useful commands

```bash
fly status              # App status and machine info
fly logs                # Stream live logs
fly ssh console         # SSH into the running container
fly volumes list        # Check volume status
fly deploy              # Redeploy after code changes
fly open                # Open the app URL in browser
```

### Custom domain (optional)

```bash
fly certs add yourdomain.com
```

Then add a CNAME record pointing `yourdomain.com` to `art-gallery.fly.dev` in your DNS.

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Images lost after deploy | Check volume is mounted: `fly volumes list`. Verify `DATA_DIR=/data` in `fly.toml` |
| 404 on gallery page | Run `fly ssh console` then `ls /app/dist/` — if empty, the build failed |
| `sharp` errors | The Dockerfile uses `node:20-slim` (Linux) — `sharp` installs correct binaries. Try `fly deploy --no-cache` |
| Admin panel not loading | Check `ls /app/dist/admin/index.html` exists via SSH |
| Slow first load | Machine is waking from sleep (~2–5s). Set `min_machines_running = 1` to stay warm (uses more free quota) |
| Volume full | `fly volumes list` shows usage. Resize: `fly volumes extend <vol_id> --size 2` |

### Future: Adding a Database

When ready to replace JSON files with a database:

| Option | Command | Notes |
|--------|---------|-------|
| **Fly Postgres** | `fly postgres create` | Managed, free tier (shared CPU + 1GB). Connect via `DATABASE_URL` env var |
| **SQLite on volume** | Already have the volume | Simplest — just use the `/data` mount. Add Litestream for backups |
| **External** (Supabase, Neon) | Set `DATABASE_URL` env var | `fly secrets set DATABASE_URL=postgres://...` |

## License

MIT
