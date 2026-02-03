import { baseURL } from './constants.js';

/**
 * Manages image uploads to S3 via presigned URLs
 */
export class UploadManager {
    constructor(editor) {
        this.editor = editor;
    }

    /**
     * Uploads all modified images to S3
     * @returns {Promise<Object>} Map of imageId -> s3Key
     */
    async uploadImages() {
        const fileMap = this.editor.imageFiles;
        const imageIds = Object.keys(fileMap);

        if (imageIds.length === 0) {
            return {};
        }

        this.editor.ui.showStatus('Preparing images for upload...', 'info');

        // 1. Prepare file list for request
        const filesToRequest = imageIds.map(id => ({
            name: fileMap[id].name,
            type: fileMap[id].type
        }));

        try {
            // 2. Request presigned URLs
            const response = await fetch(`https://api.${baseURL}/request-upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ files: filesToRequest })
            });

            if (!response.ok) {
                throw new Error(`Failed to get upload URLs: ${response.statusText}`);
            }

            const { uploads } = await response.json();
            const s3KeyMap = {};

            // 3. Upload each file
            const uploadPromises = uploads.map(async (upload, index) => {
                const imageId = imageIds[index];
                const file = fileMap[imageId];

                this.editor.ui.showStatus(`Uploading image ${index + 1}/${uploads.length}...`, 'info');

                const uploadResponse = await fetch(upload.uploadUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': file.type
                    },
                    body: file
                });

                if (!uploadResponse.ok) {
                    throw new Error(`Failed to upload ${file.name}`);
                }

                // Map the imageId to the S3 key
                s3KeyMap[imageId] = upload.key;
            });

            await Promise.all(uploadPromises);
            
            this.editor.ui.showStatus('Images uploaded successfully', 'success');
            return s3KeyMap;

        } catch (error) {
            console.error('Upload failed:', error);
            this.editor.ui.showStatus('Failed to upload images. Please try again.', 'error');
            throw error;
        }
    }
}
