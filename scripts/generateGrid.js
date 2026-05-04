// Generate grid.json with proper cell types:
// 0=air, 1=wall, 2=boundary, 3=void
const fs = require('fs');
const path = require('path');

const W = 100, D = 100;

// Initialize entire grid to 3 (void — invisible, off-map)
const grid = [];
for (let z = 0; z < D; z++) {
  grid[z] = new Array(W).fill(3);
}

// ─── Layout (centered around x=50) ───

// Main Hall: interior 12×10m
// Walls: x=44..57, z=44..55
carveRoom(44, 44, 58, 56);

// Gallery Wing: interior 14×10m
// x=58..73, z=44..55 (same z-range, attached to right)
carveRoom(58, 44, 74, 56);

// Archway: 5-cell wide opening at shared wall
for (let z = 47; z <= 51; z++) {
  grid[z][58] = 0;
}

// Now wrap boundary: every cell adjacent (8-dir) to air/wall that is void → becomes 2
wrapBoundary();

// ─── Output ───
const data = {
  width: W,
  depth: D,
  cellSize: 1,
  wallHeight: 4,
  grid: grid,
  spawn: [51, 49]
};

const outPath = path.join(__dirname, '..', 'data', 'grid.json');
fs.writeFileSync(outPath, JSON.stringify(data));
console.log(`Generated grid.json at ${outPath}`);

let air = 0, wall = 0, boundary = 0, voidC = 0;
for (let z = 0; z < D; z++) {
  for (let x = 0; x < W; x++) {
    if (grid[z][x] === 0) air++;
    else if (grid[z][x] === 1) wall++;
    else if (grid[z][x] === 2) boundary++;
    else voidC++;
  }
}
console.log(`Air: ${air}, Wall: ${wall}, Boundary: ${boundary}, Void: ${voidC}`);

// ─── Helpers ───

function carveRoom(x1, z1, x2, z2) {
  for (let z = z1; z < z2; z++) {
    for (let x = x1; x < x2; x++) {
      if (z === z1 || z === z2 - 1 || x === x1 || x === x2 - 1) {
        grid[z][x] = 1;
      } else {
        grid[z][x] = 0;
      }
    }
  }
}

function wrapBoundary() {
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      if (grid[z][x] === 0 || grid[z][x] === 1) {
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dz === 0 && dx === 0) continue;
            const nz = z + dz, nx = x + dx;
            if (nz >= 0 && nz < D && nx >= 0 && nx < W) {
              if (grid[nz][nx] === 3) { // only void → boundary
                grid[nz][nx] = 2;
              }
            }
          }
        }
      }
    }
  }
}
