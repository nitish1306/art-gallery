# Phase 1 — Implementation Plan

## How To Use This Plan

- Each step builds on the previous one
- At the end of each step there is a **Checkpoint** — do not proceed until it passes
- Steps marked with **[USER ACTION]** require you to provide files or make decisions
- Run `npm install && npm start` after Step 1 to start the dev server; it stays running throughout

---

## Step 1: Project Scaffold & Dev Server

### What to build
- Initialize `package.json` with project metadata
- Install dependencies: `express`, `sharp`, `three`, `vite`, `uuid`
- Create the full folder structure (empty placeholder files where needed):
  ```
  art-gallery/
  ├── server/
  │   ├── index.js
  │   ├── routes/admin.js
  │   ├── routes/gallery.js
  │   └── services/imageProcessor.js
  ├── public/
  │   ├── gallery/index.html
  │   ├── gallery/js/  (empty, populated in later steps)
  │   ├── gallery/css/gallery.css
  │   ├── admin/index.html
  │   ├── admin/js/   (empty, populated in later steps)
  │   ├── admin/css/admin.css
  │   └── assets/
  │       ├── artworks/
  │       ├── artworks/thumbs/
  │       ├── textures/
  │       ├── audio/
  │       └── models/
  ├── data/
  │   ├── gallery.json    (default 3-room layout)
  │   ├── artworks.json   (empty array)
  │   └── settings.json   (default settings)
  ├── PHASE1.md
  ├── PHASE2.md
  └── README.md
  ```
- `server/index.js`: Express server that:
  - Serves `public/` as static files
  - Mounts admin API routes at `/api/admin`
  - Mounts gallery data routes at `/api/gallery`
  - Listens on port 3000 (configurable via env)
- `data/gallery.json`: Pre-populate with default 3-room layout (lobby + 2 rooms)
- `data/settings.json`: Pre-populate with default theme, lighting, audio settings
- `data/artworks.json`: Empty array `[]`
- `server/routes/gallery.js`: GET endpoints to serve JSON data:
  - `GET /api/gallery/rooms` — returns gallery.json
  - `GET /api/gallery/artworks` — returns artworks.json
  - `GET /api/gallery/settings` — returns settings.json

### Checkpoint 1
1. Run `npm install && npm start`
2. Open `http://localhost:3000/gallery/` — should show a blank HTML page with title
3. Open `http://localhost:3000/admin/` — should show a blank HTML page with title
4. Open `http://localhost:3000/api/gallery/rooms` — should return the default 3-room JSON
5. Open `http://localhost:3000/api/gallery/artworks` — should return `[]`
6. Open `http://localhost:3000/api/gallery/settings` — should return default settings JSON
7. Verify folder structure matches the plan

---

## Step 2: Entry Screen & Three.js Scene Initialization

### What to build
- `public/gallery/index.html`: Basic HTML with canvas container and entry overlay
- `public/gallery/css/gallery.css`: Full-screen canvas, overlay styling, fade animation
- `public/gallery/js/main.js`:
  - Fetch settings from `/api/gallery/settings`
  - Show entry screen: gallery name + "Press Enter / Tap to Enter"
  - On keypress/tap:
    - Animate: camera zoom from 0.5x → 1x with opacity fade-in (0.5s CSS transition)
    - Hide overlay, reveal 3D scene
  - Initialize Three.js:
    - `WebGLRenderer` (antialias, shadows enabled)
    - `PerspectiveCamera` (FOV 70, responsive aspect ratio)
    - `Scene` with background color from settings
    - Render loop via `requestAnimationFrame`
    - Window resize handler
  - For now: render an empty scene with a simple ground plane (gray) so we can verify Three.js works

### Checkpoint 2
1. Open `http://localhost:3000/gallery/`
2. See entry screen with gallery name from `settings.json`
3. See "Press Enter / Tap to Enter" prompt
4. Press Enter (or tap on mobile)
5. Verify zoom-fade animation plays smoothly
6. After animation: see a 3D scene with a gray ground plane
7. Test on mobile browser (same WiFi, use local IP) — verify tap works
8. Resize browser window — scene should adjust without distortion

---

## Step 3: Room Builder — Walls, Floor, Ceiling

### What to build
- `public/gallery/js/roomBuilder.js`:
  - Fetch room data from `/api/gallery/rooms`
  - For each room in `gallery.json`:
    - Create floor (plane geometry, positioned at room's x/z position)
    - Create 4 walls (plane geometry, positioned at room edges, facing inward)
    - Create ceiling (plane geometry)
    - Cut openings in walls where rooms connect (archways)
    - Apply default white material (texture loading comes in Step 5)
  - Export room meshes and collision boundaries
- Update `main.js`: import roomBuilder, add rooms to scene
- Collision data: for each wall, store a bounding box (used later for movement collision)

### [USER ACTION]
- Review the 3-room layout in `data/gallery.json` — adjust room sizes if desired before proceeding

### Checkpoint 3
1. Open gallery — after entry animation, see 3 white rooms with floor and ceiling
2. Rooms should be connected via open archways (no doors)
3. Walk to where archways are — should see through to the next room
4. Walls, floor, ceiling should have no gaps or z-fighting
5. Open browser DevTools console — no errors
6. Verify: lobby is in the center, 2 exhibition rooms branch off from it

---

## Step 4: Desktop Controls — WASD + Mouse Look

### What to build
- `public/gallery/js/controls.js`:
  - **Pointer Lock API**: click canvas to lock mouse cursor
  - **Mouse look**: rotate camera on mouse move (pitch clamped to prevent flipping)
  - **WASD movement**: translate camera position based on key state
    - W = forward, S = backward, A = strafe left, D = strafe right
    - Shift = run (1.5x speed)
    - Smooth acceleration/deceleration (not instant start/stop)
  - **Collision detection**:
    - Before applying movement, raycast in movement direction
    - If ray hits a wall within step distance, block movement
    - Slide along walls (project velocity onto wall plane) for smooth feel
  - **Gravity**: camera stays at fixed eye height (1.6 units, ~human eye level)
  - ESC exits pointer lock (browser default)
- Update `main.js`: import controls, initialize after entry animation, update in render loop
- Spawn player at `spawnPoint` from `gallery.json`

### Checkpoint 4
1. Enter gallery, click to engage pointer lock
2. Move mouse — camera rotates smoothly, no jitter
3. WASD keys — walk forward/back/strafe, smooth acceleration
4. Walk into a wall — **should stop**, not pass through
5. Walk along a wall at an angle — should **slide** along it, not stick
6. Walk through archway into adjacent room — should pass through freely
7. Press ESC — pointer lock releases, cursor visible
8. Shift+W — moves faster than W alone
9. Look straight up/down — camera should clamp, not flip upside down
10. Verify spawn position matches `gallery.json` spawnPoint

---

## Step 5: Textures & Theming

### What to build
- Bundle default texture images in `public/assets/textures/`:
  - `white-plaster.jpg` — clean white wall texture (generate procedurally or use a tiny tileable texture)
  - `concrete.jpg` — light gray concrete floor
  - `wood.jpg` — light wood plank
  - `marble.jpg` — white/gray marble
  - Each texture: small (256x256 or 512x512), seamless/tileable
- `public/gallery/js/roomBuilder.js` updates:
  - Read texture names from `settings.json` (walls, floor, ceiling)
  - Load textures using `THREE.TextureLoader`
  - Set `texture.wrapS = texture.wrapT = THREE.RepeatWrapping`
  - Scale repeat based on room dimensions (so textures don't stretch)
  - Apply `MeshStandardMaterial` with texture maps
- Floor gets floor texture, walls get wall texture, ceiling gets ceiling texture

### [USER ACTION]
- If you have preferred texture images, drop them into `public/assets/textures/`
- Otherwise the defaults will be used (can be changed later via admin)

### Checkpoint 5
1. Enter gallery — walls should show white plaster texture (not flat white)
2. Floor should show concrete texture (or whatever is set in `settings.json`)
3. Textures should tile properly — no visible stretching or single-tile look
4. Edit `data/settings.json` → change `theme.walls` to `"marble"` → refresh
5. Walls should now show marble texture
6. Verify textures look correct at close range (walk up to a wall)
7. No texture loading errors in console

---

## Step 6: Lighting System

### What to build
- `public/gallery/js/lighting.js`:
  - **Ambient light**: `THREE.AmbientLight` with color/intensity from `settings.json`
  - **Hemisphere light**: subtle sky/ground color difference for natural feel
  - **Artwork spotlights** (placeholder positions for now — actual artwork positions come in Step 7):
    - `THREE.SpotLight` per artwork
    - Color: warm golden yellow (`#ffcc66` default, configurable)
    - Pointed at artwork position, angled from above
    - Cast shadows enabled
    - Configurable intensity, angle, penumbra, distance
  - Export function: `createArtworkSpotlight(position, target)` — called by artworkLoader later
  - **Shadow settings**: soft shadows, shadow map size 1024
- Update `main.js`:
  - Import lighting module
  - Enable `renderer.shadowMap`
  - Add ambient + hemisphere lights to scene
  - For testing: create 2-3 spotlights aimed at walls to verify look

### Checkpoint 6
1. Enter gallery — rooms should have soft ambient illumination (not pitch black, not blown out)
2. See warm golden spotlight cones on walls (test spots)
3. Spotlights should cast visible soft shadows (e.g., frame shadow on wall)
4. Walk around — lighting should feel natural and gallery-like
5. Edit `settings.json` → change spotlight color to `#ff0000` → refresh → spots should be red
6. Edit `settings.json` → change ambient intensity → verify brightness changes
7. No harsh shadows or artifacts on walls/floor

---

## Step 7: Artwork Display — Images on Walls

### What to build
- `public/gallery/js/artworkLoader.js`:
  - Fetch artwork data from `/api/gallery/artworks`
  - For each artwork:
    - Load image from `artwork.image` path using `THREE.TextureLoader`
    - Create artwork mesh: `PlaneGeometry` sized to maintain image aspect ratio
      - Max width ~1.5 units, height calculated from aspect ratio
    - Create frame mesh: slightly larger plane behind artwork with dark material (or thin box geometry for 3D frame)
    - Create placard mesh: small plane below/beside artwork
      - Render **Title**, **Date**, **Medium** as canvas texture (2D canvas → `CanvasTexture`)
    - Position artwork on assigned wall in assigned room
      - Use `wall` (north/south/east/west) and `position` (0-1 normalized along wall) from artworks.json
      - Place at eye height (~1.5 units center)
      - Offset slightly from wall to prevent z-fighting
    - Call `lighting.createArtworkSpotlight()` to aim a spotlight at this artwork
  - **Interaction — click/tap to view details**:
    - Raycaster on click/tap → detect if artwork mesh is hit
    - If hit: show detail overlay (HTML/CSS overlay, not 3D):
      - Artwork title, date, medium, full description
      - Full-resolution image (zoomable: click/pinch to zoom)
      - "Close" button returns to gallery
    - While overlay is open: pause movement controls
- Update `main.js`: import artworkLoader, initialize after rooms are built

### [USER ACTION — REQUIRED]
To see artworks, you must add at least 2-3 test artworks:
1. Drop 2-3 artwork images (JPG/PNG) into `public/assets/artworks/`
2. Edit `data/artworks.json` and add entries:
   ```json
   [
     {
       "id": "test-1",
       "title": "Test Artwork One",
       "date": "2024",
       "medium": "Oil on Canvas",
       "description": "A test artwork for development.",
       "image": "assets/artworks/your-image-1.jpg",
       "thumbnail": "assets/artworks/your-image-1.jpg",
       "room": "lobby",
       "wall": "north",
       "position": 0.5
     },
     {
       "id": "test-2",
       "title": "Test Artwork Two",
       "date": "2025",
       "medium": "Watercolor",
       "description": "Another test artwork.",
       "image": "assets/artworks/your-image-2.jpg",
       "thumbnail": "assets/artworks/your-image-2.jpg",
       "room": "room-oils",
       "wall": "east",
       "position": 0.3
     }
   ]
   ```

### Checkpoint 7
1. Enter gallery — see artwork images hanging on walls in correct rooms
2. Each artwork has a visible frame around it
3. Each artwork has a placard showing Title, Date, Medium (readable from ~2 steps away)
4. Each artwork has a warm golden spotlight illuminating it
5. Click/tap an artwork — detail overlay appears with full info + large image
6. Image in overlay is zoomable (scroll wheel or pinch)
7. Click "Close" — overlay closes, return to gallery, controls resume
8. Artwork aspect ratios are preserved (no stretching)
9. Artworks are at comfortable eye height
10. Walk to different rooms — each room shows only its assigned artworks
11. No z-fighting between artwork, frame, and wall

---

## Step 8: Ambient Music

### What to build
- `public/gallery/js/audio.js`:
  - Fetch audio settings from settings data
  - Create `Audio` element for background music
  - **Autoplay policy handling**: music starts only after first user interaction (entry screen tap/keypress)
  - Loop enabled
  - Volume set from `settings.json`, adjustable
  - **UI controls** (fixed position, bottom-right corner of gallery):
    - Volume slider
    - Mute/unmute toggle button (speaker icon)
    - Minimal, semi-transparent design that doesn't obstruct the view
  - Graceful handling: if audio file doesn't exist, log warning but don't break gallery
- Update `main.js`: import audio, start on entry

### [USER ACTION — REQUIRED]
- Place an ambient music file (MP3 or OGG) in `public/assets/audio/`
- Update `data/settings.json` → `audio.track` to match the filename
- Suggestion: search "royalty free ambient gallery music" for a free track (or we can add a placeholder silent file for testing)

### Checkpoint 8
1. Enter gallery (press Enter / tap) — music starts playing
2. Music loops seamlessly
3. Volume slider works — drag to change volume
4. Mute button works — click to mute, click again to unmute
5. Audio controls are visible but unobtrusive (bottom-right, semi-transparent)
6. Refresh page — music does NOT autoplay before entry interaction (browser policy)
7. If no audio file exists — gallery still loads without errors

---

## Step 9: Mobile Controls

### What to build
- Extend `public/gallery/js/controls.js` with mobile support:
  - **Device detection**: check touch support and screen size
  - **Virtual joystick** (left side of screen):
    - Semi-transparent circular pad
    - Touch + drag to move (direction = drag angle, speed = drag distance)
    - Returns to center on release
    - Works for forward/backward/strafe
  - **Drag-to-look** (right side of screen):
    - Touch + drag rotates camera (like mouse look)
    - Sensitivity configurable
  - **Gyroscope mode** (opt-in):
    - `DeviceOrientationEvent` for camera look rotation
    - iOS: request permission via button, handle denial gracefully
    - Android: auto-enabled
    - Gyroscope replaces drag-to-look (joystick still used for movement)
  - **Tap-to-move mode**:
    - Tap on floor → player walks smoothly to that point
    - Raycaster to find floor intersection
    - Pathfinding: straight line with collision avoidance (simple: stop at wall)
    - Drag-to-look still active for camera
  - **Settings toggle** (small gear icon, top-right):
    - Opens control mode selector: Joystick+Drag / Joystick+Gyro / Tap+Drag
    - Persists choice in localStorage
  - Hide joystick/touch controls on desktop; hide WASD instructions on mobile

### Checkpoint 9
1. **Desktop**: no mobile controls visible, WASD + mouse works as before
2. **Mobile (Joystick+Drag mode)**:
   - See virtual joystick on left side
   - Drag joystick to walk in any direction
   - Drag right side of screen to look around
   - Joystick returns to center on finger release
3. **Mobile (Joystick+Gyro mode)**:
   - Switch via settings gear icon
   - Tilt phone — camera looks in that direction
   - Joystick still works for movement
   - On iOS: permission prompt appears, handled gracefully if denied (falls back to drag)
4. **Mobile (Tap+Drag mode)**:
   - Tap on floor — player walks to that spot and stops
   - Walk stops at walls (doesn't pass through)
   - Drag to look around
5. **All mobile modes**:
   - Artworks clickable/tappable — detail overlay works
   - Audio controls accessible
   - Entry screen works with tap
   - Settings gear icon visible and functional
6. Switch between modes — each works correctly
7. Reload page — last selected mode is remembered

---

## Step 10: Admin Panel — Artwork Management

### What to build
- `server/routes/admin.js`: REST API endpoints:
  - `POST /api/admin/artworks` — upload artwork image + metadata
    - Accept multipart form data (image file + JSON fields)
    - Save original to `public/assets/artworks/`
    - Process via `imageProcessor.js` → save processed version + thumbnail
    - Add entry to `data/artworks.json`
    - Return new artwork object
  - `PUT /api/admin/artworks/:id` — update artwork metadata
  - `DELETE /api/admin/artworks/:id` — remove artwork + delete image files
  - `GET /api/admin/artworks` — list all artworks (same as gallery endpoint)
  - `POST /api/admin/artworks/:id/process` — re-process image with specific settings
- `server/services/imageProcessor.js`:
  - Using Sharp:
    - `autoFix(inputPath)` → returns { processedPath, thumbnailPath, metadata }
    - Auto-crop: `sharp.trim()` to remove whitespace borders
    - Normalize: `sharp.normalize()` for brightness/contrast
    - Resize: max 2048px longest edge for web, 300px for thumbnail
    - Format: output as JPEG (quality 85) for web, preserve original
    - Return metadata: width, height, format, size
  - `getPreview(inputPath)` → returns base64 of before + after for preview
- `public/admin/index.html` + `public/admin/js/artworkManager.js`:
  - **Artwork list view**: table/grid of all artworks with thumbnail, title, room
  - **Upload form**:
    - Drag-and-drop zone for image (or click to browse)
    - On drop: upload to server, get back before/after preview
    - Show **before/after comparison** (slider or side-by-side)
    - "Accept" button to save processed version
    - Metadata fields: title, date, medium, description
    - Room assignment dropdown (populated from gallery.json rooms)
    - Wall selector: north/south/east/west
    - Position slider: 0-1 along wall (with visual indicator)
    - "Save" button → POST to API
  - **Edit artwork**: click existing artwork → edit form pre-filled → PUT on save
  - **Delete artwork**: delete button with confirmation dialog

### [USER ACTION]
- Prepare 3-5 artwork images for testing the upload flow
- Think about room assignments and wall placements

### Checkpoint 10
1. Open `http://localhost:3000/admin/`
2. See artwork management interface (empty initially, or with test artworks from Step 7)
3. **Upload test**:
   - Drag an image onto the upload zone
   - See before/after preview (auto-cropped, brightness-fixed)
   - Fill in title, date, medium, description
   - Select room and wall from dropdowns
   - Click Save — artwork appears in the list
4. Open gallery in another tab — new artwork appears on the correct wall
5. **Edit test**: click artwork in admin → change title → save → verify in gallery
6. **Delete test**: delete an artwork → confirm → verify removed from gallery
7. **Image processing**:
   - Upload an image with white borders → verify auto-crop works
   - Upload a dark/underexposed image → verify brightness normalization
   - Check that thumbnails are generated in `assets/artworks/thumbs/`
8. Upload 3-5 artworks across different rooms to populate the gallery

---

## Step 11: Admin Panel — Room Editor (Simple) & Theme Manager

### What to build
- `public/admin/js/roomEditor.js`:
  - **Room template selector**: for each room, pick small (8x6) / medium (12x10) / large (16x12)
  - **Room list**: show all rooms with name, template, artwork count
  - **Add room**: button to add a new room (picks template, enters name)
  - **Remove room**: delete button (with warning if artworks assigned)
  - **Room connections**: checkboxes to set which rooms connect (archways)
  - **Room preview**: simple 2D canvas showing top-down layout of all rooms
    - Rooms as colored rectangles with names
    - Lines showing connections/archways
    - Auto-layout: arrange rooms in a reasonable pattern (linear or branching)
  - **Spawn point**: dropdown to select which room the visitor starts in
  - Save → writes to `data/gallery.json` via API
- `server/routes/admin.js` — additional endpoints:
  - `GET /api/admin/rooms` — get gallery.json
  - `PUT /api/admin/rooms` — update entire gallery layout
  - `POST /api/admin/rooms` — add a room
  - `DELETE /api/admin/rooms/:id` — remove a room
- `public/admin/js/themeManager.js`:
  - **Texture picker**: for walls, floor, ceiling — show thumbnail grid of available textures
  - **Lighting controls**:
    - Ambient light: color picker + intensity slider
    - Spotlight: color picker + intensity slider + angle slider
  - **Audio settings**: track selector (list files in `assets/audio/`), volume slider
  - **Gallery name**: text input
  - Save → writes to `data/settings.json` via API
- `server/routes/admin.js` — settings endpoints:
  - `GET /api/admin/settings` — get settings.json
  - `PUT /api/admin/settings` — update settings

### Checkpoint 11
1. Open admin panel — see tabs/sections for Artworks, Rooms, Theme
2. **Room editor**:
   - See list of 3 default rooms
   - Change lobby template from medium to large → save
   - Open gallery → lobby should be bigger
   - Add a 4th room, connect it to an existing room → save
   - Open gallery → 4th room visible and walkable
   - Remove the 4th room → save → gallery back to 3 rooms
   - 2D preview canvas shows room layout accurately
3. **Theme manager**:
   - Click a different wall texture → save → gallery walls change
   - Adjust spotlight color to pure white → save → gallery spotlights change
   - Change gallery name → save → entry screen shows new name
   - Change ambient intensity → save → gallery brightness changes
4. All changes persist across server restarts (saved to JSON files)
5. No data corruption — artworks.json, gallery.json, settings.json remain valid JSON

---

## Step 12: Polish, Performance & Final Integration

### What to build
- **Performance**:
  - Texture mipmapping and anisotropic filtering
  - Frustum culling (Three.js default, but verify it's working)
  - Only load artwork textures for visible/nearby rooms
  - Dispose textures when far away (memory management)
  - Target: 60fps on mid-range mobile with 10 artworks, 30fps+ with 50
- **Gallery polish**:
  - Smooth camera bob while walking (subtle, optional)
  - Footstep sound effect (subtle, optional)
  - Artwork hover highlight: subtle glow/outline when looking at an artwork (indicates it's interactive)
  - Interaction prompt: small "Click to view" text when hovering artwork
  - Loading indicator while artwork images load
  - Crosshair or dot in center of screen (desktop, subtle)
- **Admin polish**:
  - Form validation (required fields, image format check)
  - Success/error toast notifications on save
  - Responsive design — admin works on mobile too
  - Unsaved changes warning before navigating away
- **Error handling**:
  - Missing artwork image → placeholder "Image not found" texture
  - Corrupt gallery.json → server returns error, admin shows warning
  - API errors → user-friendly messages in admin panel
- **README.md**:
  - Project description
  - Prerequisites (Node.js 18+)
  - Setup: `npm install && npm start`
  - How to access gallery and admin panel
  - How to add artworks (via admin)
  - How to customize theme
  - Folder structure overview
  - License (suggest MIT)

### Checkpoint 12 — FINAL
1. **Full walkthrough test (desktop)**:
   - Open gallery → entry screen looks clean
   - Press Enter → smooth zoom-fade transition
   - Walk through all rooms → no wall clipping, smooth movement
   - All artworks visible with frames, placards, spotlights
   - Click artwork → detail modal works, image zoomable, close works
   - Music playing, volume controls work
   - Consistent 60fps (check DevTools Performance tab)
2. **Full walkthrough test (mobile)**:
   - Open on phone → entry screen, tap to enter
   - All 3 control modes work (test each)
   - Artworks tappable, detail modal works on small screen
   - Audio controls accessible
   - No janky scrolling or viewport issues
   - Acceptable framerate (30fps+)
3. **Admin full test**:
   - Upload 5+ artworks with different images
   - Assign to different rooms and walls
   - Edit an artwork's metadata
   - Delete an artwork
   - Change room templates
   - Change theme textures and lighting
   - Verify all changes reflect in gallery
4. **Stress test**:
   - Add 20+ artworks → gallery still loads and runs smoothly
   - Rapid room switching → no crashes
5. **Fresh clone test**:
   - Delete `node_modules/`
   - Run `npm install && npm start`
   - Everything works from scratch
6. **README review**: follow README instructions from scratch — they should be complete and accurate

---

## Summary

| Step | What                              | Key Deliverable                              |
| ---- | --------------------------------- | -------------------------------------------- |
| 1    | Project Scaffold & Dev Server     | Running Express server, API returns JSON     |
| 2    | Entry Screen & Three.js Init      | Entry animation, empty 3D scene visible      |
| 3    | Room Builder                      | 3 textured rooms with archways               |
| 4    | Desktop Controls                  | WASD + mouse look with collision             |
| 5    | Textures & Theming                | Configurable wall/floor/ceiling textures     |
| 6    | Lighting System                   | Ambient + golden spotlights with shadows     |
| 7    | Artwork Display                   | Images on walls, placards, detail modal      |
| 8    | Ambient Music                     | Background music with volume controls        |
| 9    | Mobile Controls                   | 3 control modes + gyroscope                  |
| 10   | Admin — Artwork Management        | Upload, edit, delete artworks with image fix |
| 11   | Admin — Rooms & Theme             | Room editor, texture picker, lighting config |
| 12   | Polish & Final Integration        | Performance, UX polish, README, full testing |
