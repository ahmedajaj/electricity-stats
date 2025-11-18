#!/usr/bin/env node

/**
 * Single-run scraper and Gist uploader
 * Designed to be called by cron - runs once then exits
 */

const { exec } = require('child_process');
const path = require('path');
const GistUploader = require('./gist-uploader');

require('dotenv').config();

const dataFile = path.join(__dirname, '../data', 'events.json');
const logFile = path.join(__dirname, '../data', 'gist-cron.log');
const fs = require('fs');

function log(message) {
    const timestamp = new Date().toLocaleString('uk-UA', { 
        timeZone: 'Europe/Kiev',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const logMessage = `[${timestamp}] ${message}\n`;
    
    // Log to console
    console.log(logMessage.trim());
    
    // Append to log file
    fs.appendFileSync(logFile, logMessage);
}

async function run() {
    log('Starting scrape and Gist upload...');
    
    try {
        // Initialize uploader
        const uploader = new GistUploader();
        await uploader.initialize();
        
        // Run the scraper
        await new Promise((resolve, reject) => {
            exec('node src/scraper.js', (error, stdout, stderr) => {
                if (error) {
                    log(`Scraper error: ${error.message}`);
                    reject(error);
                    return;
                }
                
                if (stdout) {
                    log(`Scraper: ${stdout.trim()}`);
                }
                
                resolve();
            });
        });
        
        // Upload to Gist
        const result = await uploader.uploadToGist(dataFile);
        
        if (result.changed) {
            const stats = uploader.getStats(dataFile);
            log(`✓ Changes uploaded to Gist`);
            log(`  URL: ${result.gistUrl}`);
            log(`  Stats: ${stats.total} events (${stats.on} on, ${stats.off} off)`);
            
            if (stats.lastEvent) {
                log(`  Last: ${stats.lastEvent.status.toUpperCase()} at ${stats.lastEvent.date}`);
            }
        } else {
            log('ℹ No changes detected, Gist not updated');
        }
        
        log('✓ Completed successfully\n');
        process.exit(0);
        
    } catch (error) {
        log(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

run();
