#!/usr/bin/env node

/**
 * Single-run scraper and Gist uploader
 * Designed to be called by cron/launchd - runs once then exits
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const GistUploader = require('./gist-uploader');

require('dotenv').config({ path: path.join(__dirname, '../data/.env'), quiet: true });

const dataFile = path.join(__dirname, '../data', 'events.json');
const logFile = path.join(__dirname, '../data', 'gist-cron.log');
const scraperPath = path.join(__dirname, 'scraper.js');

function getTimestamp() {
    return new Date().toLocaleString('uk-UA', {
        timeZone: 'Europe/Kyiv',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function log(message) {
    fs.appendFileSync(logFile, `${message}\n`);
}

function runScraper() {
    return new Promise((resolve, reject) => {
        execFile(process.execPath, [scraperPath], {
            cwd: path.join(__dirname, '..'),
            env: { ...process.env, NODE_ENV: 'production' },
            timeout: 5 * 60 * 1000,
        }, (error, stdout, stderr) => {
            const output = `${stdout}\n${stderr}`.split('\n').map(l => l.trim());
            // Only keep the summary / result lines (✓ … or ❌ …)
            output.filter(l => l.startsWith('✓') || l.startsWith('❌')).forEach(log);
            if (error) reject(new Error(`Scraper failed: ${error.message.split('\n')[0]}`));
            else resolve();
        });
    });
}

async function run() {
    const startTime = Date.now();
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
        const uploader = new GistUploader();
        await uploader.initialize();

        await runScraper();

        const result = await uploader.uploadToGist(dataFile);
        if (result.changed) {
            const stats = uploader.getStats(dataFile);
            log('✅ Uploaded to Gist');
            if (stats.lastEvent) {
                const statusIcon = stats.lastEvent.status === 'on' ? '💡' : '🔌';
                log(`   ${statusIcon} ${stats.lastEvent.status.toUpperCase()} at ${new Date(stats.lastEvent.date).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}`);
            }
        } else {
            log('ℹ️  No changes');
        }
        process.exitCode = 0;
    } catch (error) {
        log(`❌ ${error.message}`);
        process.exitCode = 1;
    } finally {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        log(`⏱️  ${duration}s | End: ${getTimestamp()}`);
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
}

run();
