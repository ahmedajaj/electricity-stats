const fs = require('fs');
const path = require('path');

// Change to project root directory
process.chdir(path.join(__dirname, '..'));

console.log('🔍 Checking Electricity Stats Configuration...\n');

const checks = {
    passed: [],
    warnings: [],
    errors: []
};

// Check .env file
if (fs.existsSync('.env')) {
    checks.passed.push('.env file exists');
    
    const envContent = fs.readFileSync('.env', 'utf8');
    const requiredVars = ['TELEGRAM_API_ID', 'TELEGRAM_API_HASH', 'TELEGRAM_PHONE'];
    
    requiredVars.forEach(varName => {
        if (envContent.includes(varName)) {
            const match = envContent.match(new RegExp(`${varName}=(.+)`));
            if (match && match[1] && match[1].trim() && !match[1].includes('your_')) {
                checks.passed.push(`${varName} is configured`);
            } else {
                checks.errors.push(`${varName} is not set in .env`);
            }
        } else {
            checks.errors.push(`${varName} missing from .env`);
        }
    });
} else {
    checks.errors.push('.env file not found - copy from .env.example');
}

// Check node_modules
if (fs.existsSync('node_modules')) {
    checks.passed.push('Dependencies installed');
} else {
    checks.errors.push('Dependencies not installed - run: npm install');
}

// Check data directory
if (fs.existsSync('data')) {
    checks.passed.push('Data directory exists');
    
    if (fs.existsSync('data/events.json')) {
        try {
            const events = JSON.parse(fs.readFileSync('data/events.json', 'utf8'));
            checks.passed.push(`Data file exists with ${events.length} events`);
        } catch (e) {
            checks.warnings.push('data/events.json exists but may be corrupted');
        }
    } else {
        checks.warnings.push('No data collected yet - run: npm run scrape');
    }
} else {
    checks.warnings.push('Data directory will be created on first run');
}

// Check session
if (fs.existsSync('session.json')) {
    checks.passed.push('Telegram session saved (no login needed)');
} else {
    checks.warnings.push('No Telegram session - will need to login on first scrape');
}

// Check public directory
if (fs.existsSync('public/index.html') && 
    fs.existsSync('public/app.js') && 
    fs.existsSync('public/styles.css')) {
    checks.passed.push('Web interface files present');
} else {
    checks.errors.push('Missing web interface files');
}

// Display results
console.log('✅ PASSED:');
checks.passed.forEach(item => console.log(`   ✓ ${item}`));

if (checks.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    checks.warnings.forEach(item => console.log(`   ⚠ ${item}`));
}

if (checks.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    checks.errors.forEach(item => console.log(`   ✗ ${item}`));
    console.log('\n🔧 Fix the errors above before proceeding.\n');
    process.exit(1);
} else if (checks.warnings.length > 0) {
    console.log('\n💡 Next Steps:');
    if (!fs.existsSync('data/events.json')) {
        console.log('   1. Run: npm run scrape (to collect data)');
        console.log('   2. Run: npm start (to start server)');
    } else {
        console.log('   Run: npm start (to start server)');
    }
    console.log('   Visit: http://localhost:3000\n');
} else {
    console.log('\n🎉 Everything looks good!');
    console.log('\n💡 Ready to start:');
    console.log('   Run: npm start');
    console.log('   Visit: http://localhost:3000\n');
}
