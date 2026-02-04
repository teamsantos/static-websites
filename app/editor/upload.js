import { baseURL, supportEmail } from './constants.js';

/**
 * Manages image uploads to the upload lambda (which uploads to S3)
 */
export class UploadManager {
    constructor(editor) {
        this.editor = editor;
        // Conservative limit: 3MB for images, accounting for base64 encoding overhead (~33%)
        // and the rest of the request body (projectName, JSON structure)
        this.MAX_PAYLOAD_SIZE = 3 * 1024 * 1024; // 3MB
        this.MAX_COMPRESSED_SIZE = 2 * 1024 * 1024; // 2MB target for compressed images
    }

    /**
     * Converts a File object to a base64 string
     * @param {File} file 
     * @returns {Promise<string>} base64 encoded string (without data URI prefix)
     */
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remove the data URI prefix (e.g., "data:image/jpeg;base64,")
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Compresses an image using canvas
     * @param {File} file - The image file to compress
     * @param {number} targetSize - Target size in bytes
     * @returns {Promise<{base64: string, base64Length: number, mimeType: string}>}
     */
    async compressImage(file, targetSize = this.MAX_COMPRESSED_SIZE) {
        // SVG files cannot be compressed via canvas (they would be rasterized)
        if (file.type === 'image/svg+xml') {
            throw new Error(`SVG files cannot be compressed. Please use a smaller SVG file: ${file.name}`);
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let objectUrl = null;

            img.onload = () => {
                // Revoke the object URL to prevent memory leak
                if (objectUrl) {
                    URL.revokeObjectURL(objectUrl);
                }

                let { width, height } = img;
                let quality = 0.8;
                let scale = 1;

                // Calculate initial scale based on file size
                if (file.size > targetSize * 2) {
                    // If file is much larger than target, scale down dimensions
                    scale = Math.sqrt(targetSize / file.size);
                    scale = Math.max(scale, 0.3); // Don't scale below 30%
                }

                // Apply scaling
                width = Math.round(width * scale);
                height = Math.round(height * scale);

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                // Determine output format - preserve PNG for transparency support
                const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

                // Try to achieve target size by adjusting quality (iterative approach)
                let q = quality;
                while (q >= 0.3) {
                    const dataUrl = canvas.toDataURL(outputType, q);
                    const base64 = dataUrl.split(',')[1];
                    const base64Length = base64.length;

                    if (base64Length <= targetSize) {
                        resolve({ base64, base64Length, mimeType: outputType });
                        return;
                    }
                    q -= 0.1;
                }

                // Even at minimum quality, image is still too large
                reject(new Error(`Image "${file.name}" is too large even after compression. Please use a smaller image.`));
            };

            img.onerror = () => {
                // Revoke the object URL on error too
                if (objectUrl) {
                    URL.revokeObjectURL(objectUrl);
                }
                reject(new Error(`Failed to load image: ${file.name}`));
            };

            objectUrl = URL.createObjectURL(file);
            img.src = objectUrl;
        });
    }

    /**
     * Estimates the base64 size of a file (base64 encoding adds ~33% overhead)
     * @param {number} fileSize 
     * @returns {number}
     */
    estimateBase64Size(fileSize) {
        return Math.ceil(fileSize * 1.37); // ~37% overhead including JSON structure
    }

    /**
     * Gets the project name from the input field
     * @returns {string}
     */
    getProjectName() {
        const input = document.getElementById('project-name');
        return input?.value?.trim() || `project-${Date.now()}`;
    }

    /**
     * Uploads a batch of images to the lambda
     * @param {Array<{imageId: string, name: string, type: string, base64: string}>} images
     * @param {string} projectName
     * @returns {Promise<Array<{imageId: string, key: string}>>}
     */
    async uploadBatch(images, projectName) {
        const response = await fetch(`https://api.${baseURL}/request-upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectName,
                images: images.map(img => ({
                    imageId: img.imageId,
                    name: img.name,
                    type: img.type,
                    data: img.base64
                }))
            })
        });

        const data = await response.json();

        if (!response.ok) {
            // Check for specific error codes
            if (data.code === 'TOO_MANY_FILES') {
                throw new Error('TOO_MANY_UPLOADS');
            }
            throw new Error(data.error || `Upload failed: ${response.statusText}`);
        }

        // Check for partial failures
        if (data.errors && data.errors.length > 0) {
            console.warn('Some images failed to upload:', data.errors);
        }

        return data.uploads;
    }

    /**
     * Uploads all modified images to S3 via the upload lambda
     * @returns {Promise<Object>} Map of imageId -> s3Key
     */
    async uploadImages() {
        const fileMap = this.editor.imageFiles;
        const imageIds = Object.keys(fileMap);

        if (imageIds.length === 0) {
            return {};
        }

        this.editor.ui.showStatus('Preparing images for upload...', 'info');

        const projectName = this.getProjectName();
        const s3KeyMap = {};

        // Prepare images with base64 data, batching by size
        const batches = [];
        let currentBatch = [];
        let currentBatchSize = 0;
        // Account for request overhead (projectName, JSON structure, etc.)
        const requestOverhead = projectName.length + 100; // ~100 bytes for JSON structure

        try {
            for (const imageId of imageIds) {
                const file = fileMap[imageId];
                let base64;
                let type = file.type;
                let estimatedSize = this.estimateBase64Size(file.size);

                // Check if single image is too large for the lambda
                if (estimatedSize > this.MAX_PAYLOAD_SIZE - requestOverhead) {
                    // Need to compress this image
                    this.editor.ui.showStatus(`Compressing large image: ${file.name}...`, 'info');
                    
                    try {
                        const compressed = await this.compressImage(file, this.MAX_COMPRESSED_SIZE);
                        base64 = compressed.base64;
                        type = compressed.mimeType;
                        // Use actual base64 length (already encoded, no estimation needed)
                        estimatedSize = compressed.base64Length;
                    } catch (compressError) {
                        console.error('Compression failed:', compressError);
                        throw new Error(compressError.message || `Failed to compress image: ${file.name}`);
                    }
                } else {
                    base64 = await this.fileToBase64(file);
                    // Use actual base64 length instead of estimate for accurate batching
                    estimatedSize = base64.length;
                }

                const imageData = {
                    imageId,
                    name: file.name,
                    type,
                    base64
                };

                // Check if adding this image would exceed the batch size limit
                if (currentBatchSize + estimatedSize > this.MAX_PAYLOAD_SIZE - requestOverhead) {
                    if (currentBatch.length > 0) {
                        // Start a new batch
                        batches.push(currentBatch);
                        currentBatch = [];
                        currentBatchSize = 0;
                    }
                }

                // Verify single image doesn't exceed max batch size (even after compression)
                if (estimatedSize > this.MAX_PAYLOAD_SIZE - requestOverhead) {
                    throw new Error(`Image "${file.name}" is too large to upload (${Math.round(estimatedSize / 1024)}KB). Please use a smaller image.`);
                }

                currentBatch.push(imageData);
                currentBatchSize += estimatedSize;
            }

            // Add the last batch
            if (currentBatch.length > 0) {
                batches.push(currentBatch);
            }

            // Upload all batches
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                this.editor.ui.showStatus(
                    `Uploading images (batch ${i + 1}/${batches.length})...`,
                    'info'
                );

                const uploads = await this.uploadBatch(batch, projectName);

                // Map imageId to S3 key
                for (const upload of uploads) {
                    if (upload.imageId) {
                        s3KeyMap[upload.imageId] = upload.key;
                    }
                }
            }

            this.editor.ui.showStatus('Images uploaded successfully', 'success');
            return s3KeyMap;

        } catch (error) {
            console.error('Upload failed:', error);
            
            // Handle specific error types
            if (error.message === 'TOO_MANY_UPLOADS') {
                this.editor.ui.showStatus(
                    `Upload limit reached. Please contact ${supportEmail} for help.`,
                    'error'
                );
            } else {
                this.editor.ui.showStatus(
                    'We are experiencing some issues. Please try again later.',
                    'error'
                );
            }
            
            throw error;
        }
    }
}
