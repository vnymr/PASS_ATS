#!/usr/bin/env node

/**
 * Simple test for pipeline - loads env before importing anything
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// IMPORTANT: Load environment variables BEFORE importing any modules that use them
dotenv.config({ path: join(__dirname, '.env') });

// Check for API key before loading modules
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in environment variables');
  process.exit(1);
}

console.log('✅ OpenAI API key loaded');

// Now import the pipeline after env is loaded
const { testPipeline } = await import('./lib/pipeline/runPipeline.js');

async function main() {
  console.log('\n========================================');
  console.log('  PIPELINE INTEGRATION TEST (SIMPLE)');
  console.log('========================================\n');

  try {
    console.log('🚀 Running pipeline test...\n');
    const result = await testPipeline();

    if (result.success) {
      console.log('\n✅ Pipeline test completed successfully!');
      console.log('\nResult summary:');
      console.log('- PDF generated:', !!result.artifacts?.pdfBuffer);
      console.log('- PDF size:', result.artifacts?.pdfMetadata?.size, 'bytes');
      console.log('- Template used:', result.artifacts?.templateUsed);
      console.log('- Generation type:', result.artifacts?.generationType);

      if (result.artifacts?.metrics) {
        console.log('- Total duration:', result.artifacts.metrics.totalDuration, 'ms');
      }
    } else {
      console.log('\n❌ Pipeline test failed');
      console.log('Error:', result.error);

      if (result.artifacts?.pipelineLog) {
        console.log('\nPipeline log:');
        result.artifacts.pipelineLog.forEach(entry => {
          console.log(`  - ${entry.stage}: ${entry.duration || 'N/A'}ms`);
        });
      }
    }
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);