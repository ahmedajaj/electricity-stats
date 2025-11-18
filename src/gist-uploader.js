const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '../data/.env') });

const githubToken = process.env.GITHUB_TOKEN;
const gistId = process.env.GIST_ID;
const isDev = process.env.NODE_ENV !== 'production';

class GistUploader {
    constructor() {
        if (!githubToken) {
            throw new Error('GITHUB_TOKEN is required in environment variables');
        }
        
        this.octokit = null;
        this.gistId = gistId;
        this.hashFile = path.join(__dirname, '../data', '.last-upload-hash');
    }

    async initialize() {
        if (!this.octokit) {
            const { Octokit } = await import('@octokit/rest');
            this.octokit = new Octokit({ auth: githubToken });
        }
        return this;
    }

    /**
     * Calculate hash of file content
     */
    getFileHash(filePath) {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const content = fs.readFileSync(filePath, 'utf8');
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * Get the hash of last uploaded version
     */
    getLastUploadHash() {
        if (!fs.existsSync(this.hashFile)) {
            return null;
        }
        return fs.readFileSync(this.hashFile, 'utf8').trim();
    }

    /**
     * Save the hash of current upload
     */
    saveUploadHash(hash) {
        fs.writeFileSync(this.hashFile, hash);
    }

    /**
     * Check if file has changed since last upload
     */
    hasChanged(filePath) {
        const currentHash = this.getFileHash(filePath);
        const lastHash = this.getLastUploadHash();
        
        if (isDev) {
            console.log('Current hash:', currentHash);
            console.log('Last hash:', lastHash);
        }
        
        return currentHash !== lastHash;
    }

    /**
     * Upload or update a Gist
     */
    async uploadToGist(filePath, filename = 'events.json', description = 'Electricity Status Events') {
        // Ensure octokit is initialized
        await this.initialize();

        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        // Check if file has changed
        if (!this.hasChanged(filePath)) {
            if (isDev) console.log('No changes detected, skipping upload');
            return { changed: false, gistUrl: null };
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const currentHash = this.getFileHash(filePath);

        try {
            let gistUrl;

            if (this.gistId) {
                // Update existing gist
                if (isDev) console.log(`Updating existing Gist: ${this.gistId}...`);
                
                const response = await this.octokit.gists.update({
                    gist_id: this.gistId,
                    description: description,
                    files: {
                        [filename]: {
                            content: content
                        }
                    }
                });

                gistUrl = response.data.html_url;
                if (isDev) console.log(`✓ Gist updated: ${gistUrl}`);
            } else {
                // Create new gist
                if (isDev) console.log('Creating new Gist...');
                
                const response = await this.octokit.gists.create({
                    description: description,
                    public: true,
                    files: {
                        [filename]: {
                            content: content
                        }
                    }
                });

                gistUrl = response.data.html_url;
                this.gistId = response.data.id;
                
                console.log(`✓ New Gist created: ${gistUrl}`);
                console.log(`\nIMPORTANT: Add this to your .env file:`);
                console.log(`GIST_ID=${this.gistId}\n`);
            }

            // Save hash of uploaded version
            this.saveUploadHash(currentHash);

            return { 
                changed: true, 
                gistUrl: gistUrl,
                gistId: this.gistId 
            };

        } catch (error) {
            console.error('Failed to upload to Gist:', error.message);
            throw error;
        }
    }

    /**
     * Get statistics from events file
     */
    getStats(filePath) {
        if (!fs.existsSync(filePath)) {
            return null;
        }

        const events = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const onCount = events.filter(e => e.status === 'on').length;
        const offCount = events.filter(e => e.status === 'off').length;
        const lastEvent = events[events.length - 1];

        return {
            total: events.length,
            on: onCount,
            off: offCount,
            lastEvent: lastEvent ? {
                status: lastEvent.status,
                date: lastEvent.date
            } : null
        };
    }
}

module.exports = GistUploader;

// If run directly
if (require.main === module) {
    (async () => {
        const uploader = new GistUploader();
        await uploader.initialize();
        const dataFile = path.join(__dirname, '../data', 'events.json');
        
        console.log('Uploading to GitHub Gist...');
        
        try {
            const result = await uploader.uploadToGist(dataFile);
            if (result.changed) {
                const stats = uploader.getStats(dataFile);
                console.log(`\n✓ Upload successful!`);
                console.log(`Stats: ${stats.total} events (${stats.on} on, ${stats.off} off)`);
                if (stats.lastEvent) {
                    console.log(`Last: ${stats.lastEvent.status.toUpperCase()} at ${stats.lastEvent.date}`);
                }
            } else {
                console.log('\n✓ No changes to upload');
            }
        } catch (error) {
            console.error('Upload failed:', error.message);
            process.exit(1);
        }
    })();
}
