/**
 * Security Check Script
 * Run before NPM publish or Git commit to prevent hardcoded sensitive IP/ports or names.
 */
import fs from 'fs';
import path from 'path';

// Define the sensitive patterns to block
const SENSITIVE_PATTERNS = [
    /192\.168\.\d{1,3}\.\d{1,3}/g, // Internal IP 192.168.x.x
    /10\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, // Internal IP 10.x.x.x
    /172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}/g, // Internal IP 172.16-31.x.x
];

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadLocalSensitivePatterns() {
    const denyListPath = path.join(process.cwd(), '.security-denylist.json');
    if (!fs.existsSync(denyListPath)) return [];

    try {
        const raw = fs.readFileSync(denyListPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map(item => String(item || '').trim())
            .filter(Boolean)
            .map(item => new RegExp(escapeRegExp(item), 'gi'));
    } catch (error) {
        console.warn(`⚠️ Failed to load local denylist from ${denyListPath}:`, error.message || error);
        return [];
    }
}

const ALL_PATTERNS = [...SENSITIVE_PATTERNS, ...loadLocalSensitivePatterns()];

// Directories or files to check
const ITEMS_TO_CHECK = ['src', 'skills', 'README.md'];

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    let hasError = false;

    ALL_PATTERNS.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
            console.error(`❌ [SECURITY ALERT] Found sensitive info "${matches[0]}" in ${filePath}`);
            hasError = true;
        }
    });

    return hasError;
}

function scanDirectory(dir) {
    let hasError = false;
    if (!fs.existsSync(dir)) return hasError;

    const stat = fs.statSync(dir);
    if (stat.isFile()) {
        if (scanFile(dir)) hasError = true;
        return hasError;
    }

    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (scanDirectory(fullPath)) hasError = true;
        } else {
            // Only check text files
            if (/\.(md|ts|js|json)$/.test(file)) {
                if (scanFile(fullPath)) hasError = true;
            }
        }
    });

    return hasError;
}

console.log('🛡️  Running Security Check...');
if (ALL_PATTERNS.length > SENSITIVE_PATTERNS.length) {
    console.log('ℹ️ Loaded extra local denylist patterns from .security-denylist.json');
}
let failed = false;

ITEMS_TO_CHECK.forEach(item => {
    if (scanDirectory(item)) failed = true;
});

if (failed) {
    console.error('\n🚫 SECURITY CHECK FAILED! Please remove sensitive information before publishing.');
    process.exit(1);
} else {
    console.log('✅ Security Check Passed. No sensitive information found.');
}
