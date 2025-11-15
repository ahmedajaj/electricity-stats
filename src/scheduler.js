const cron = require('node-cron');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const isDev = process.env.NODE_ENV !== 'production';

// Schedule data update every 6 hours
cron.schedule('0 */6 * * *', () => {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] Running scheduled update...`);
    
    exec('node src/scraper.js', (error, stdout, stderr) => {
        if (error) {
            console.error(`[${timestamp}] Update failed:`, error.message);
            logUpdate(timestamp, 'error', error.message);
            return;
        }
        
        console.log(`[${timestamp}] ${stdout.trim()}`);
        logUpdate(timestamp, 'success', stdout);
    });
});

function logUpdate(timestamp, status, message) {
    const logFile = path.join(__dirname, '../data', 'update-log.txt');
    const logEntry = `[${timestamp}] ${status.toUpperCase()}: ${message}\n`;
    fs.appendFileSync(logFile, logEntry);
}

console.log('✓ Scheduler started - updates every 6 hours (00:00, 06:00, 12:00, 18:00)');

// Keep the script running
process.on('SIGINT', () => {
    console.log('\nScheduler stopped.');
    process.exit();
});
