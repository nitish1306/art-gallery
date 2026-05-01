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

## Original File Names Reference

All `.js`, `.css`, `.html`, and `.json` files have been renamed with `.txt` appended. All `.jpg` and `.png` asset files were removed. Below is the original file structure for reference.

### Renamed Files (original → current)

| Original Path | Renamed To |
|---|---|
| `index.html` | `index.html.txt` |
| `package.json` | `package.json.txt` |
| `package-lock.json` | `package-lock.json.txt` |
| `vite.config.js` | `vite.config.js.txt` |
| `admin/index.html` | `admin/index.html.txt` |
| `data/artworks.json` | `data/artworks.json.txt` |
| `data/gallery.json` | `data/gallery.json.txt` |
| `data/settings.json` | `data/settings.json.txt` |
| `server/index.js` | `server/index.js.txt` |
| `server/routes/admin.js` | `server/routes/admin.js.txt` |
| `server/routes/gallery.js` | `server/routes/gallery.js.txt` |
| `server/services/imageProcessor.js` | `server/services/imageProcessor.js.txt` |
| `src/admin/admin.css` | `src/admin/admin.css.txt` |
| `src/admin/artworkManager.js` | `src/admin/artworkManager.js.txt` |
| `src/admin/roomEditor.js` | `src/admin/roomEditor.js.txt` |
| `src/admin/tabs.js` | `src/admin/tabs.js.txt` |
| `src/admin/themeManager.js` | `src/admin/themeManager.js.txt` |
| `src/admin/toast.js` | `src/admin/toast.js.txt` |
| `src/gallery/artworkLoader.js` | `src/gallery/artworkLoader.js.txt` |
| `src/gallery/audio.js` | `src/gallery/audio.js.txt` |
| `src/gallery/controls.js` | `src/gallery/controls.js.txt` |
| `src/gallery/gallery.css` | `src/gallery/gallery.css.txt` |
| `src/gallery/hud.js` | `src/gallery/hud.js.txt` |
| `src/gallery/interaction.js` | `src/gallery/interaction.js.txt` |
| `src/gallery/lighting.js` | `src/gallery/lighting.js.txt` |
| `src/gallery/main.js` | `src/gallery/main.js.txt` |
| `src/gallery/mobileControls.js` | `src/gallery/mobileControls.js.txt` |
| `src/gallery/quality.js` | `src/gallery/quality.js.txt` |
| `src/gallery/roomBuilder.js` | `src/gallery/roomBuilder.js.txt` |

### Removed Asset Files

| Original Path | Extension |
|---|---|
| `public/assets/artworks/abstract-blue.jpg` | .jpg |
| `public/assets/artworks/garden.jpg` | .jpg |
| `public/assets/artworks/pic1.png` | .png |
| `public/assets/artworks/sunset-valley.jpg` | .jpg |
| `public/assets/artworks/upload_5b4bc16f-3535-4e7d-bc9e-4021a23eebf2.jpg` | .jpg |
| `public/assets/artworks/thumbs/upload_5b4bc16f-3535-4e7d-bc9e-4021a23eebf2_thumb.jpg` | .jpg |
| `public/assets/textures/concrete.jpg` | .jpg |
| `public/assets/textures/marble.jpg` | .jpg |
| `public/assets/textures/white-plaster.jpg` | .jpg |
| `public/assets/textures/wood.jpg` | .jpg |

### Renamed Placeholder Files

| Original Path | Renamed To |
|---|---|
| `public/assets/artworks/.gitkeep` | `public/assets/artworks/gitkeep.txt` |
| `public/assets/artworks/thumbs/.gitkeep` | `public/assets/artworks/thumbs/gitkeep.txt` |
| `public/assets/audio/.gitkeep` | `public/assets/audio/gitkeep.txt` |
| `public/assets/models/.gitkeep` | `public/assets/models/gitkeep.txt` |
| `public/assets/textures/.gitkeep` | `public/assets/textures/gitkeep.txt` |

## License

MIT
