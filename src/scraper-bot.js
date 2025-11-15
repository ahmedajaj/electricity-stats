// Telegram Bot API approach - No phone auth needed!
// Install: npm install node-telegram-bot-api

const TelegramBot = require('node-telegram-bot-api');
const https = require('https');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_USERNAME = '@lvivskiy7a'; // or channel ID
const isDev = process.env.NODE_ENV !== 'production';

// Simple HTTP request helper
function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function scrapeWithBot() {
    if (!BOT_TOKEN) {
        throw new Error('TELEGRAM_BOT_TOKEN not set in .env file');
    }

    if (isDev) console.log('Fetching messages via Telegram Bot API...');

    try {
        // Get channel info first
        const channelInfo = await httpsGet(
            `https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${CHANNEL_USERNAME}`
        );

        if (!channelInfo.ok) {
            throw new Error('Could not access channel. Make sure bot is a member!');
        }

        // Note: Bot API has limitations for reading channel history
        // This approach works best with a bot that receives real-time updates
        
        console.log('Bot API has limited access to channel history.');
        console.log('For better results, use the RSS approach or keep the current scraper.');
        console.log('\nTo use this properly:');
        console.log('1. Add your bot to the channel as admin');
        console.log('2. Set up webhook or polling to receive new messages');
        console.log('3. Store them as they arrive (real-time monitoring)');

    } catch (error) {
        console.error('Bot scraper error:', error.message);
        throw error;
    }
}

scrapeWithBot().catch(console.error);
