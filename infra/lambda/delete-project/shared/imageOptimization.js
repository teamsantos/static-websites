import Sharp from "sharp";
import AWS from "aws-sdk";

const s3 = new AWS.S3();

/**
 * Image Optimization Module
 *
 * Optimizes images for web delivery:
 * - Multiple formats (WEBP, PNG, JPEG)
 * - Responsive sizes (sm, md, lg, xl)
 * - Quality compression
 * - Metadata stripping
 *
 * Performance: Reduces image size by 60-80%
 * Example: 2MB JPG → 400KB WEBP
 */

const IMAGE_SIZES = {
  sm: { width: 400, height: 300 },    // Mobile
  md: { width: 800, height: 600 },    // Tablet
  lg: { width: 1200, height: 900 },   // Desktop
  xl: { width: 1600, height: 1200 },  // Large desktop
};

const QUALITY_LEVELS = {
  sm: 75,  // Mobile: Lower quality acceptable
  md: 80,  // Tablet: Medium quality
  lg: 85,  // Desktop: High quality
  xl: 90,  // Large: Maximum quality
};

/**
 * Optimize a single image (base64 data)
 * Generates multiple sizes and formats
 *
 * @param {string} imageData - Base64 encoded image data
 * @param {string} imageName - Image filename (for metadata)
 * @param {string} format - Image format (jpeg, png, webp, etc)
 * @returns {Promise<object>} - Optimized image variants
 */
export async function optimizeImage(imageData, imageName, format) {
  try {
    const buffer = Buffer.from(imageData, "base64");

    // Get image metadata first
    const metadata = await Sharp(buffer).metadata();
    console.log(`[ImageOpt] Original: ${imageName} - ${metadata.width}x${metadata.height} ${format}`);

    const optimized = {};

    // Generate each size variant
    for (const [sizeKey, dimensions] of Object.entries(IMAGE_SIZES)) {
      // Skip upscaling - only scale down
      if (metadata.width < dimensions.width) {
        optimized[sizeKey] = {
          format: format,
          size: buffer.length,
          width: metadata.width,
          height: metadata.height,
          buffer: buffer, // Use original if already smaller
        };
        continue;
      }

      // WEBP variant (best compression)
      try {
        const webpBuffer = await Sharp(buffer)
          .resize(dimensions.width, dimensions.height, {
            fit: "cover",
            withoutEnlargement: true,
          })
          .webp({ quality: QUALITY_LEVELS[sizeKey] })
          .toBuffer();

        optimized[`${sizeKey}_webp`] = {
          format: "webp",
          size: webpBuffer.length,
          width: dimensions.width,
          height: dimensions.height,
          buffer: webpBuffer,
        };
      } catch (err) {
        console.warn(`[ImageOpt] WEBP conversion failed for ${imageName} ${sizeKey}:`, err);
      }

      // PNG variant (lossless, larger)
      try {
        const pngBuffer = await Sharp(buffer)
          .resize(dimensions.width, dimensions.height, {
            fit: "cover",
            withoutEnlargement: true,
          })
          .png({ compressionLevel: 9 })
          .toBuffer();

        optimized[`${sizeKey}_png`] = {
          format: "png",
          size: pngBuffer.length,
          width: dimensions.width,
          height: dimensions.height,
          buffer: pngBuffer,
        };
      } catch (err) {
        console.warn(`[ImageOpt] PNG conversion failed for ${imageName} ${sizeKey}:`, err);
      }

      // Original format variant (JPEG)
      if (format === "jpeg" || format === "jpg") {
        try {
          const jpegBuffer = await Sharp(buffer)
            .resize(dimensions.width, dimensions.height, {
              fit: "cover",
              withoutEnlargement: true,
            })
            .jpeg({ quality: QUALITY_LEVELS[sizeKey], progressive: true })
            .toBuffer();

          optimized[`${sizeKey}_jpeg`] = {
            format: "jpeg",
            size: jpegBuffer.length,
            width: dimensions.width,
            height: dimensions.height,
            buffer: jpegBuffer,
          };
        } catch (err) {
          console.warn(`[ImageOpt] JPEG conversion failed for ${imageName} ${sizeKey}:`, err);
        }
      }
    }

    // Log savings
    const totalOptimizedSize = Object.values(optimized).reduce((sum, v) => sum + v.size, 0);
    const savings = ((1 - totalOptimizedSize / (buffer.length * Object.keys(IMAGE_SIZES).length)) * 100).toFixed(1);
    console.log(`[ImageOpt] Optimized ${imageName}: ${savings}% total savings`);

    return optimized;
  } catch (error) {
    console.error(`[ImageOpt] Error optimizing ${imageName}:`, error);
    throw error;
  }
}

/**
 * Upload optimized images to S3
 * Stores with srcset metadata for responsive images
 *
 * @param {object} optimizedImages - Output from optimizeImage()
 * @param {string} projectName - Project folder in S3
 * @param {string} imageName - Image filename
 * @returns {Promise<object>} - S3 paths for each variant
 */
export async function uploadOptimizedImages(optimizedImages, projectName, imageName) {
  try {
    const uploadPromises = [];
    const s3Paths = {};

    for (const [variantKey, variant] of Object.entries(optimizedImages)) {
      const s3Key = `projects/${projectName}/images/${imageName}/${variantKey}.${variant.format}`;
      
      uploadPromises.push(
        s3.putObject({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: s3Key,
          Body: variant.buffer,
          ContentType: `image/${variant.format}`,
          CacheControl: "public, max-age=31536000", // 1 year cache
          Metadata: {
            "original-size": String(variant.width),
            "original-height": String(variant.height),
          },
        }).promise()
          .then(() => {
            s3Paths[variantKey] = `/images/${imageName}/${variantKey}.${variant.format}`;
          })
      );
    }

    await Promise.all(uploadPromises);
    console.log(`[ImageOpt] Uploaded ${Object.keys(optimizedImages).length} variants for ${imageName}`);

    return s3Paths;
  } catch (error) {
    console.error(`[ImageOpt] Error uploading images:`, error);
    throw error;
  }
}

/**
 * Generate HTML srcset for responsive images
 * Used in template injection to serve best format
 *
 * @param {object} s3Paths - Output from uploadOptimizedImages()
 * @param {string} fallbackUrl - Fallback image URL
 * @returns {string} - HTML srcset attribute value
 */
export function generateSrcset(s3Paths, fallbackUrl) {
  const srcset = [];

  // Prefer WEBP for modern browsers
  if (s3Paths.sm_webp) srcset.push(`${s3Paths.sm_webp} 400w`);
  if (s3Paths.md_webp) srcset.push(`${s3Paths.md_webp} 800w`);
  if (s3Paths.lg_webp) srcset.push(`${s3Paths.lg_webp} 1200w`);
  if (s3Paths.xl_webp) srcset.push(`${s3Paths.xl_webp} 1600w`);

  return srcset.join(", ") || fallbackUrl;
}

/**
 * Get size statistics for logging/monitoring
 *
 * @param {object} optimizedImages - Output from optimizeImage()
 * @returns {object} - Statistics about optimization
 */
export function getOptimizationStats(optimizedImages) {
  const stats = {
    variantCount: Object.keys(optimizedImages).length,
    totalSize: 0,
    byFormat: {},
  };

  for (const [key, variant] of Object.entries(optimizedImages)) {
    stats.totalSize += variant.size;
    const fmt = variant.format;
    if (!stats.byFormat[fmt]) {
      stats.byFormat[fmt] = { count: 0, size: 0 };
    }
    stats.byFormat[fmt].count++;
    stats.byFormat[fmt].size += variant.size;
  }

  return stats;
}
