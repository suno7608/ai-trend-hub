#!/usr/bin/env node
/**
 * AI Trend Hub — Content Schema Validator
 * Validates markdown files against required YAML frontmatter schema
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const CONTENT_DIR = path.resolve(__dirname, '..', 'content');

const DAILY_REQUIRED = [
  'id', 'date_published', 'source_name', 'source_id',
  'title', 'canonical_url', 'categories', 'summary_ko', 'summary_en',
  'so_what_ko', 'so_what_en'
];

const WEEKLY_REQUIRED = ['week', 'title'];
const MONTHLY_REQUIRED = ['month', 'title'];

let errors = 0;
let warnings = 0;
let total = 0;

function validate(dir, requiredFields, type) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

  files.forEach(f => {
    total++;
    const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
    let parsed;
    try {
      parsed = matter(raw);
    } catch (e) {
      console.error(`❌ [${type}] ${f}: YAML parse error — ${e.message}`);
      errors++;
      return;
    }

    const data = parsed.data;

    // Check required fields
    requiredFields.forEach(field => {
      if (!data[field] && data[field] !== 0) {
        console.error(`❌ [${type}] ${f}: missing required field "${field}"`);
        errors++;
      }
    });

    // Daily-specific validations
    if (type === 'daily') {
      // Date format
      if (data.date_published && !/^\d{4}-\d{2}-\d{2}$/.test(data.date_published)) {
        console.error(`❌ [${type}] ${f}: invalid date_published format (expected YYYY-MM-DD)`);
        errors++;
      }

      // URL validation
      if (data.canonical_url && !data.canonical_url.startsWith('http')) {
        console.error(`❌ [${type}] ${f}: canonical_url must start with http(s)`);
        errors++;
      }

      // Categories must be array
      if (data.categories && !Array.isArray(data.categories)) {
        console.error(`❌ [${type}] ${f}: categories must be an array`);
        errors++;
      }

      // Tags must be array
      if (data.tags && !Array.isArray(data.tags)) {
        console.warn(`⚠️ [${type}] ${f}: tags should be an array`);
        warnings++;
      }

      // Summary length check
      if (data.summary_ko && data.summary_ko.length > 500) {
        console.warn(`⚠️ [${type}] ${f}: summary_ko exceeds 500 chars (${data.summary_ko.length})`);
        warnings++;
      }

      // Confidence range
      if (data.confidence !== undefined && (data.confidence < 0 || data.confidence > 1)) {
        console.warn(`⚠️ [${type}] ${f}: confidence should be between 0 and 1`);
        warnings++;
      }
    }
  });
}

console.log('🔍 AI Trend Hub — Content Validation');
console.log('====================================\n');

validate(path.join(CONTENT_DIR, 'daily'), DAILY_REQUIRED, 'daily');
validate(path.join(CONTENT_DIR, 'weekly'), WEEKLY_REQUIRED, 'weekly');
validate(path.join(CONTENT_DIR, 'monthly'), MONTHLY_REQUIRED, 'monthly');

console.log(`\n📊 Results: ${total} files checked, ${errors} errors, ${warnings} warnings`);

// Write validation summary to file for other scripts to read
const summaryPath = path.resolve(__dirname, '..', 'data', 'validation-result.json');
const fs2 = require('fs');
fs2.writeFileSync(summaryPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  total, errors, warnings,
  passed: errors === 0
}, null, 2));

if (errors > 0) {
  console.log('\n❌ Validation FAILED');
  console.log(`   ${errors} error(s) found — pipeline will continue but content may have issues`);
  // Exit with code 2 (soft fail) — workflow can check this
  process.exit(2);
} else {
  console.log('\n✅ Validation PASSED');
  process.exit(0);
}
