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

The built files will be in the `dist/` folder. Serve with any static file server alongside the API:

```bash
npm start
```