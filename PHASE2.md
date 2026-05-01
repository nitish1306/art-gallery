# Phase 2 — Post-MVP Enhancements

## Overview

Features to add after Phase 1 is stable and deployed locally. Each item is independent
and can be picked up in any order based on priority.

---

## Features

### 1. 3D Artwork Support

- Load `.glb` / `.gltf` 3D models into the gallery
- Display on pedestals in room centers or designated zones
- **Interactive:** visitors can rotate/inspect 3D objects by clicking and dragging
- **Walkable:** visitors can walk around the pedestal and view from all angles
- Admin panel: upload 3D model files, assign to room, set pedestal position
- Auto-generate preview thumbnail from 3D model for admin UI

### 2. Full Visual Floor Plan Editor

- Upgrade from template-based editor to full drag-and-drop 2D canvas
- Drag to resize room dimensions
- Drag artwork thumbnails onto specific wall positions
- Add/remove rooms dynamically
- Drag to reposition rooms and create custom layouts
- Real-time 2D top-down preview of the gallery
- Optional: 3D mini-preview of layout

### 3. Landing Page & Artist Branding

- Customizable landing/splash page before entering the gallery
- Artist name, bio, photo/logo
- Links to social media, website, contact
- Configurable via admin panel
- Template options (minimal, portfolio-style, full creative)

### 4. Additional Room Templates & Shapes

- L-shaped rooms
- Circular/curved rooms
- Multi-level rooms (mezzanine / balcony)
- Outdoor courtyard spaces
- Custom wall angles (not just rectangular)

### 5. Audio Guide Per Artwork

- Optional audio narration per artwork
- Upload audio clip via admin panel
- Play button on artwork detail modal
- Auto-play option when viewer approaches artwork (proximity trigger)
- Visual indicator (headphone icon) on artworks that have audio

### 6. Visitor Analytics

- Privacy-respecting, self-hosted analytics (no third-party tracking)
- Track: total visits, time spent, most viewed artworks, room heatmap
- Simple dashboard in admin panel
- Data stored in local JSON files
- Optional: export analytics as CSV

### 7. Deployment Scripts

- One-click deploy configurations for:
  - **Netlify** (static export mode)
  - **Vercel** (serverless functions for admin API)
  - **Docker** (containerized, single `docker-compose up`)
  - **GitHub Pages** (static-only gallery, no admin)
- README instructions for each platform
- Environment variable configuration for production

### 8. PWA Support

- Progressive Web App — installable on mobile home screen
- Service worker for offline caching of gallery assets
- App manifest with gallery icon and name
- Works offline after first load (gallery + artworks cached)

### 9. Additional Themes & Styles

- Classic ornate museum (crown molding, warm wood, marble floors)
- Industrial loft (exposed brick, concrete, metal)
- Dark gallery (black walls, dramatic lighting)
- Outdoor sculpture garden
- Custom theme builder in admin panel
- Community-shared theme packs

### 10. Enhanced Lighting System

- Time-of-day simulation (natural light changes)
- Colored accent lighting per room
- Neon/LED strip lighting options for modern themes
- Light/shadow baking for performance

### 11. Multi-Language Support

- Configurable UI language
- Artwork descriptions in multiple languages
- Language switcher in gallery and admin
- i18n JSON files for translations

### 12. Admin Authentication

- Optional password protection for admin panel
- Simple local auth (no external auth services)
- Useful when deploying to public URLs

### 13. VR Headset Support

- WebXR integration for Meta Quest and similar headsets
- Room-scale walking in VR
- Hand controller interaction with artworks
- Teleport movement option

### 14. Social & Sharing

- Share link to a specific artwork (deep linking)
- Social media meta tags (Open Graph) for link previews
- Optional guestbook / visitor comments (stored locally)
- QR code generation for artwork links

### 15. Performance Optimization

- Lazy-load artworks by room (only load visible room + adjacent)
- LOD (Level of Detail) for 3D models
- Texture compression and streaming
- Instanced rendering for repeated geometry
- Target: smooth 60fps on mid-range phones with 100 artworks

---

## Priority Suggestion

| Priority | Feature                        | Impact | Effort |
| -------- | ------------------------------ | ------ | ------ |
| High     | 3D Artwork Support             | High   | Medium |
| High     | Deployment Scripts             | High   | Low    |
| High     | Admin Authentication           | Medium | Low    |
| Medium   | Full Visual Floor Plan Editor  | High   | High   |
| Medium   | Landing Page & Artist Branding | Medium | Low    |
| Medium   | Performance Optimization       | High   | Medium |
| Medium   | PWA Support                    | Medium | Low    |
| Low      | Additional Themes              | Medium | Medium |
| Low      | Audio Guide Per Artwork        | Low    | Low    |
| Low      | Visitor Analytics              | Low    | Medium |
| Low      | Multi-Language Support          | Low    | Medium |
| Low      | VR Headset Support             | Low    | High   |
| Low      | Social & Sharing               | Low    | Low    |
| Low      | Additional Room Shapes         | Medium | High   |
