const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const baseDir = process.env.DATA_DIR || path.join(__dirname, '..', '..');
const artworksDir = path.join(baseDir, 'public', 'assets', 'artworks');
const thumbsDir = path.join(artworksDir, 'thumbs');

// Ensure thumbs directory exists
if (!fs.existsSync(thumbsDir)) {
  fs.mkdirSync(thumbsDir, { recursive: true });
}

/**
 * Process an uploaded artwork image:
 * - Auto-trim whitespace borders
 * - Normalize brightness/contrast
 * - Resize to max 2048px longest edge for web
 * - Generate 300px thumbnail
 * Returns { processedPath, thumbnailPath, metadata }
 */
async function autoFix(inputPath) {
  const basename = path.basename(inputPath, path.extname(inputPath));
  const processedName = basename + '.jpg';
  const thumbName = basename + '_thumb.jpg';
  const processedPath = path.join(artworksDir, processedName);
  const thumbPath = path.join(thumbsDir, thumbName);

  // Process main image
  const pipeline = sharp(inputPath);
  const meta = await pipeline.metadata();

  let processed = sharp(inputPath);

  // Trim whitespace borders (ignore errors if trim finds nothing)
  try {
    processed = processed.trim({ threshold: 20 });
  } catch (_) {
    // trim failed — continue without it
    processed = sharp(inputPath);
  }

  // Normalize brightness/contrast
  processed = processed.normalize();

  // Resize — longest edge max 2048
  const maxDim = 2048;
  if (meta.width > maxDim || meta.height > maxDim) {
    processed = processed.resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true });
  }

  // Save processed JPEG
  await processed.jpeg({ quality: 85 }).toFile(processedPath);

  // Get processed image metadata
  const processedMeta = await sharp(processedPath).metadata();

  // Generate thumbnail — 300px longest edge
  await sharp(processedPath)
    .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(thumbPath);

  return {
    processedPath: 'assets/artworks/' + processedName,
    thumbnailPath: 'assets/artworks/thumbs/' + thumbName,
    metadata: {
      width: processedMeta.width,
      height: processedMeta.height,
      format: processedMeta.format,
      size: processedMeta.size,
    },
  };
}

/**
 * Generate base64 before/after preview for an uploaded image.
 */
async function getPreview(inputPath) {
  // "Before" — resize original to 400px for preview
  const beforeBuf = await sharp(inputPath)
    .resize(400, 400, { fit: 'inside' })
    .jpeg({ quality: 75 })
    .toBuffer();

  // "After" — trim + normalize + resize for preview
  let afterPipeline = sharp(inputPath);
  try {
    afterPipeline = afterPipeline.trim({ threshold: 20 });
  } catch (_) {
    afterPipeline = sharp(inputPath);
  }
  const afterBuf = await afterPipeline
    .normalize()
    .resize(400, 400, { fit: 'inside' })
    .jpeg({ quality: 75 })
    .toBuffer();

  return {
    before: 'data:image/jpeg;base64,' + beforeBuf.toString('base64'),
    after: 'data:image/jpeg;base64,' + afterBuf.toString('base64'),
  };
}

module.exports = { autoFix, getPreview };
