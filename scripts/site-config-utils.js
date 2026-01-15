#!/usr/bin/env node
// Utility to load site-config.js in CommonJS context
const fs = require('fs');
const path = require('path');
const { error } = require('./log');

/**
 * Load site-config.js and extract SITE_CONFIG
 * Uses regex to extract the config object since site-config.js uses ES6 export
 * @param {string} configPath - Path to site-config.js
 * @returns {Object} The SITE_CONFIG object
 */
function loadSiteConfig(configPath) {
    try {
        const content = fs.readFileSync(configPath, 'utf8');

        // Extract the SITE_CONFIG object using regex
        // Match: export const SITE_CONFIG = { ... };
        const match = content.match(
            /export\s+const\s+SITE_CONFIG\s*=\s*(\{[\s\S]*?\});/,
        );

        if (!match) {
            error(
                'Failed to find SITE_CONFIG in ' +
                configPath +
                '. Expected: export const SITE_CONFIG = { ... };',
            );
            process.exit(1);
        }

        let configStr = match[1];

        // Remove JavaScript comments (both // and /* */)
        // Remove single-line comments
        configStr = configStr.replace(/\/\/.*$/gm, '');
        // Remove multi-line comments
        configStr = configStr.replace(/\/\*[\s\S]*?\*\//g, '');

        // Replace trailing commas in object/array literals (common in JS but invalid JSON)
        configStr = configStr.replace(/,(\s*[}\]])/g, '$1');

        // Quote unquoted keys: match word characters followed by : 
        // This handles keys like: default: { or 'abdulkerimsesli.de': {
        configStr = configStr.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/g, '$1"$2":');

        // Convert single quotes to double quotes for JSON compatibility
        configStr = configStr.replace(/'/g, '"');

        try {
            const config = JSON.parse(configStr);
            return config;
        } catch (parseErr) {
            error('Failed to parse SITE_CONFIG object as JSON: ' + parseErr.message);
            error('Config string: ' + configStr.substring(0, 500));
            process.exit(1);
        }
    } catch (e) {
        error('Failed to load site-config from ' + configPath + ': ' + e.message);
        process.exit(1);
    }
}

module.exports = {
    loadSiteConfig,
};
