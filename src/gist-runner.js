#!/usr/bin/env node

/**
 * Single-run scraper and Gist uploader
 * Designed to be called by cron - runs once then exits
 */

const { exec } = require('child_process');
const path = require('path');
const GistUploader = require('./gist-uploader');

require('dotenv').config({ path: path.join(__dirname, '../data/.env'), silent: true });

const dataFile = path.join(__dirname, '../data', 'events.json');
const logFile = path.join(__dirname, '../data', 'gist-cron.log');
const fs = require('fs');

let startTime;

function getTimestamp() {
    return new Date().toLocaleString('uk-UA', { 
        timeZone: 'Europe/Kiev',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function log(message, includeTimestamp = false) {
    const prefix = includeTimestamp ? `[${getTimestamp()}] ` : '';
    const logMessage = `${prefix}${message}\n`;
    
    // Append to log file
    fs.appendFileSync(logFile, logMessage);
}

async function run() {
    startTime = Date.now();
    
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
        // Initialize uploader
        const uploader = new GistUploader();
        await uploader.initialize();
        
        // Run the scraper (suppress verbose output)
        await new Promise((resolve, reject) => {
            const scraperPath = path.join(__dirname, 'scraper.js');
            exec(`DOTENV_CONFIG_SILENT=true node "${scraperPath}" 2>&1 | grep -E "^(✓|❌)"`, { 
                cwd: path.join(__dirname, '..'),
                shell: '/bin/bash' 
            }, (error, stdout, stderr) => {
                if (error) {
                    log(`❌ Scraper error: ${error.message}`);
                    reject(error);
                    return;
                }
                
                // Only log the summary line (✓ Scraped...)
                const lines = stdout.trim().split('\n');
                const summaryLine = lines.find(line => line.includes('✓ Scraped'));
                if (summaryLine) {
                    log(summaryLine.trim());
                }
                
                resolve();
            });
        });
        
        // Upload to Gist
        const result = await uploader.uploadToGist(dataFile);
        
        if (result.changed) {
            const stats = uploader.getStats(dataFile);
            log('✅ Uploaded to Gist');
            
            if (stats.lastEvent) {
                const statusIcon = stats.lastEvent.status === 'on' ? '💡' : '🔌';
                log(`   ${statusIcon} ${stats.lastEvent.status.toUpperCase()} at ${new Date(stats.lastEvent.date).toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' })}`);
            }
        } else {
            log('ℹ️  No changes');
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        log(`⏱️  ${duration}s | End: ${getTimestamp()}`);
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        process.exit(0);
        
    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        log(`❌ ${error.message}`);
        log(`⏱️  ${duration}s | End: ${getTimestamp()}`);
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        process.exit(1);
    }
}

run();
