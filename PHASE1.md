# Phase 1 — MVP

## Overview

A self-hosted, free, open-source 3D virtual art gallery. One repo = one artist's website.
Artist clones the repo, configures via admin panel, runs `npm start`, done.

---

## Tech Stack

| Layer            | Tool              | Why                                                    |
| ---------------- | ----------------- | ------------------------------------------------------ |
| 3D Engine        | Three.js          | Full control over lighting, theming, mobile touch       |
| Build Tool       | Vite              | Fast dev server, hot reload, modern bundling            |
| Backend          | Node.js + Express | Admin API, image processing, serves gallery             |
| Image Processing | Sharp             | Auto-fix, resize, thumbnails on upload                  |
| Data Storage     | JSON files        | No database; git-friendly, human-editable               |
| Styling (Admin)  | Vanilla CSS       | Keep dependencies minimal                               |

---

## Architecture

```
art-gallery/
├── server/
│   ├── index.js                 # Entry point
│   ├── routes/
│   │   ├── admin.js             # Admin API (CRUD artworks, rooms, settings)
│   │   └── gallery.js           # Serve gallery data as JSON
│   └── services/
│       └── imageProcessor.js    # Sharp-based auto-fix pipeline
│
├── public/
│   ├── gallery/                 # 3D gallery frontend
│   │   ├── index.html
│   │   ├── js/
│   │   │   ├── main.js          # Three.js scene setup
│   │   │   ├── controls.js      # WASD + mouse (desktop), touch + gyro (mobile)
│   │   │   ├── roomBuilder.js   # Builds 3D rooms from config
│   │   │   ├── artworkLoader.js # Places artworks on walls
│   │   │   ├── lighting.js      # Spotlight system
│   │   │   └── audio.js         # Ambient music manager
│   │   └── css/
│   │
│   ├── admin/                   # Admin panel (separate SPA)
│   │   ├── index.html
│   │   ├── js/
│   │   │   ├── artworkManager.js  # Upload, edit, delete artworks
│   │   │   ├── roomEditor.js      # Simple template-based room editor
│   │   │   ├── themeManager.js    # Switch wall/floor textures & lighting
│   │   │   └── imagePreview.js    # Before/after image fix preview
│   │   └── css/
│   │
│   └── assets/
│       ├── artworks/            # Uploaded artwork images (originals + processed)
│       ├── textures/            # Wall, floor, ceiling textures (bundled defaults)
│       ├── audio/               # Ambient music tracks
│       └── models/              # Placeholder for future 3D models
│
├── data/
│   ├── gallery.json             # Rooms, layout, connections
│   ├── artworks.json            # Artwork metadata
│   └── settings.json            # Theme, music, gallery name
│
├── package.json
└── README.md
```

---

## Features

### 1. 3D Gallery Navigation

- First-person walkthrough using Three.js
- Collision detection — cannot walk through walls
- Open archways between rooms (no doors)
- Smooth movement with configurable walk speed

### 2. Room System

- **3 rooms** to start: 1 central lobby + 2 exhibition rooms
- Rooms defined in `gallery.json` with dimensions, position, connections
- Configurable via simple room templates (small / medium / large)
- Multiple connected rooms with open archways for free roaming
- Auto-layout based on template selection

### 3. Artwork Display

- 2D images rendered on walls with frames
- Placard next to each artwork: **Title**, **Date**, **Medium**
- Click/tap artwork opens a detail modal:
  - Full description text
  - Zoomable 2D image view
  - Close button to return to gallery
- Artworks grouped by medium — artist manually assigns to rooms via admin

### 4. Lighting

- Soft ambient light throughout the gallery
- **Warm golden spotlight** on each artwork (adjustable intensity/color in settings)
- Subtle shadows for depth and realism
- Per-artwork spotlight auto-positioned based on artwork placement

### 5. Theming

- Default: **modern minimalist white-cube** gallery
- Wall, floor, ceiling textures configurable in `settings.json`
- Bundled texture packs:
  - White plaster
  - Concrete
  - Wood
  - Marble
- Easy to add new textures: drop image into `assets/textures/`, reference in settings
- Architecture designed so themes/styles can evolve easily in later phases

### 6. Controls — Desktop

- **WASD** keys for movement (forward/back/strafe)
- **Mouse look** for camera rotation
- Pointer lock on click for immersive experience

### 7. Controls — Mobile (3 modes, user selects in settings)

| Mode                     | Movement              | Look                    |
| ------------------------ | --------------------- | ----------------------- |
| Joystick + Drag (default)| Virtual joystick (left)| Drag right side of screen|
| Joystick + Gyroscope     | Virtual joystick (left)| Device tilt/rotation     |
| Tap-to-move + Drag       | Tap point on floor     | Drag to look around      |

- Gyroscope: opt-in, iOS permission prompt handled automatically
- Gyroscope controls camera look direction only (movement still via joystick)

### 8. Ambient Music

- Background audio loop, starts on user interaction (browser autoplay policy)
- Volume slider control
- Mute/unmute toggle
- Configurable track in `settings.json`
- Audio file placed in `assets/audio/`

### 9. Admin Panel

- **Artwork Management**
  - Drag-and-drop image upload
  - Auto-process on upload via Sharp:
    - Crop whitespace/borders
    - Brightness/contrast normalization
    - White balance correction
    - Resize for web (optimized + thumbnail)
  - Before/after preview — artist approves before saving
  - Edit metadata: title, date, medium, description
  - Assign artwork to room and wall
  - Delete artwork

- **Room Editor (Simple — template-based)**
  - Pick room templates: small, medium, large
  - Set number of rooms (up to reasonable limit)
  - Auto-layout with connected archways
  - Assign artworks to rooms via dropdown selectors

- **Theme Manager**
  - Select wall/floor/ceiling textures from bundled packs
  - Adjust spotlight color and intensity
  - Preview changes (optional in MVP)

### 10. Entry Screen

- Displays gallery name
- Prompt: "Press Enter / Tap to Enter"
- Transition: **0.5x zoom → 1x with fade-in** animation on keypress/tap
- Minimal design, no artist bio (deferred to later)

### 11. Data Model

**`gallery.json`** — Room layout:
```json
{
  "rooms": [
    {
      "id": "lobby",
      "name": "Welcome",
      "template": "medium",
      "width": 12,
      "depth": 10,
      "height": 4,
      "position": [0, 0],
      "connections": ["room-oils"]
    },
    {
      "id": "room-oils",
      "name": "Oil Paintings",
      "template": "large",
      "width": 14,
      "depth": 10,
      "height": 4,
      "position": [12, 0],
      "connections": ["lobby", "room-watercolors"]
    }
  ],
  "spawnPoint": { "room": "lobby", "position": [6, 0, 5] }
}
```

**`artworks.json`** — Artwork metadata:
```json
[
  {
    "id": "artwork-1",
    "title": "Sunset Over the Valley",
    "date": "2024",
    "medium": "Oil on Canvas",
    "description": "A vivid landscape capturing the golden hour...",
    "image": "artworks/sunset-valley.jpg",
    "thumbnail": "artworks/thumbs/sunset-valley.jpg",
    "room": "room-oils",
    "wall": "north",
    "position": 0.3
  }
]
```

**`settings.json`** — Global settings:
```json
{
  "galleryName": "My Art Gallery",
  "theme": {
    "walls": "white-plaster",
    "floor": "concrete",
    "ceiling": "white-plaster"
  },
  "lighting": {
    "ambient": { "color": "#ffffff", "intensity": 0.4 },
    "spotlight": { "color": "#ffcc66", "intensity": 1.2, "angle": 0.4 }
  },
  "audio": {
    "track": "audio/ambient.mp3",
    "volume": 0.3,
    "autoplay": true
  }
}
```

---

## Scale

- **Start:** 5-10 artworks across 3 rooms
- **Support up to:** ~100 artworks (lazy-load artworks by room for performance)

## Hosting

- Pure localhost for now
- Zero paid services — all open-source tooling
- Single command: `npm install && npm start`

## Constraints

- No database — JSON files only
- No paid APIs or services
- No VR headset support (deferred)
- No user authentication on admin panel for MVP (local use only)
