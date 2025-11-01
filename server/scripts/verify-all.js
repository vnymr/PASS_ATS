/**
 * Comprehensive verification of pgvector integration
 */

import 'dotenv/config';
import { embeddingsDb, testConnection, closeConnection } from '../lib/embeddings-db.js';
import { saveConversationSummary, searchRelevantSummaries } from '../lib/memory/summary-store.js';
import { generateEmbedding, createConversationSummary } from '../lib/memory/embedding-utils.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';
const RESET = '\x1b[0m';

let passCount = 0;
let failCount = 0;

function pass(message) {
  console.log(`${GREEN}✓${RESET} ${message}`);
  passCount++;
}

function fail(message, error) {
  console.log(`${RED}✗${RESET} ${message}`);
  if (error) console.log(`  ${RED}Error: ${error.message}${RESET}`);
  failCount++;
}

function section(title) {
  console.log(`\n${BLUE}━━━ ${title} ━━━${RESET}\n`);
}

async function verify() {
  try {
    console.log(`${BLUE}╔══════════════════════════════════════════╗${RESET}`);
    console.log(`${BLUE}║  pgvector Integration Verification      ║${RESET}`);
    console.log(`${BLUE}╚══════════════════════════════════════════╝${RESET}`);

    // Test 1: Database Connection
    section('1. Database Connection');
    try {
      const connected = await testConnection();
      if (connected) {
        pass('Database connection successful');
      } else {
        fail('Database connection failed');
      }
    } catch (error) {
      fail('Database connection error', error);
    }

    // Test 2: pgvector Extension
    section('2. pgvector Extension');
    try {
      const result = await embeddingsDb`
        SELECT extname, extversion
        FROM pg_extension
        WHERE extname = 'vector'
      `;
      if (result.length > 0) {
        pass(`pgvector extension installed (v${result[0].extversion})`);
      } else {
        fail('pgvector extension not found');
      }
    } catch (error) {
      fail('Failed to check pgvector extension', error);
    }

    // Test 3: Table Existence
    section('3. Database Schema');
    try {
      const result = await embeddingsDb`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'conversation_summaries'
        ORDER BY ordinal_position
      `;
      if (result.length > 0) {
        pass(`conversation_summaries table exists with ${result.length} columns`);
        console.log('   Columns:', result.map(r => r.column_name).join(', '));
      } else {
        fail('conversation_summaries table not found');
      }
    } catch (error) {
      fail('Failed to check table schema', error);
    }

    // Test 4: Embedding Generation
    section('4. Embedding Generation');
    try {
      const testText = "Test embedding generation";
      const embedding = await generateEmbedding(testText);
      if (embedding && embedding.length === 1536) {
        pass(`Embedding generated successfully (${embedding.length} dimensions)`);
      } else {
        fail(`Invalid embedding dimensions: ${embedding?.length || 'null'}`);
      }
    } catch (error) {
      fail('Failed to generate embedding', error);
    }

    // Test 5: Save Summary
    section('5. Save Conversation Summary');
    try {
      const testId = `verify_${Date.now()}`;
      const summary = "User discussed software engineering jobs at tech companies";
      const embedding = await generateEmbedding(summary);

      await saveConversationSummary({
        id: testId,
        conversationId: 'verify_conv_001',
        userId: 9999,
        summary,
        embedding,
        importance: 7
      });
      pass('Summary saved successfully');
    } catch (error) {
      fail('Failed to save summary', error);
    }

    // Test 6: Search Summaries
    section('6. Semantic Search');
    try {
      const query = "looking for engineering positions";
      const queryEmbedding = await generateEmbedding(query);

      const results = await searchRelevantSummaries({
        userId: 9999,
        queryEmbedding,
        limit: 3
      });

      if (results.length > 0) {
        pass(`Found ${results.length} relevant summaries`);
        console.log(`   Best match distance: ${results[0].distance.toFixed(4)}`);
        console.log(`   Summary: "${results[0].summary.substring(0, 60)}..."`);
      } else {
        fail('No summaries found');
      }
    } catch (error) {
      fail('Failed to search summaries', error);
    }

    // Test 7: Conversation Summary Creation
    section('7. Conversation Summary Utility');
    try {
      const conversation = [
        { role: 'user', content: 'Find me product manager jobs' },
        { role: 'assistant', content: 'I found 10 PM jobs in your area' },
        { role: 'user', content: 'Filter for startups only' },
        { role: 'assistant', content: 'Filtered to 5 startup PM positions' }
      ];

      const summary = createConversationSummary(conversation, 200);
      if (summary && summary.length > 0) {
        pass('Conversation summary created');
        console.log(`   Length: ${summary.length} chars`);
      } else {
        fail('Failed to create conversation summary');
      }
    } catch (error) {
      fail('Failed to create conversation summary', error);
    }

    // Test 8: Data Integrity
    section('8. Data Integrity');
    try {
      const count = await embeddingsDb`
        SELECT COUNT(*) as total
        FROM conversation_summaries
      `;
      pass(`Database contains ${count[0].total} summaries`);

      const withEmbeddings = await embeddingsDb`
        SELECT COUNT(*) as total
        FROM conversation_summaries
        WHERE embedding IS NOT NULL
      `;
      pass(`${withEmbeddings[0].total} summaries have embeddings`);
    } catch (error) {
      fail('Failed to check data integrity', error);
    }

    // Test 9: Persona Integration Check
    section('9. Code Integration');
    try {
      // Check if persona.js has the memory loading code
      const fs = await import('fs');
      const personaCode = fs.readFileSync('./lib/agents/persona.js', 'utf8');

      if (personaCode.includes('searchRelevantSummaries')) {
        pass('Persona.js integrated with memory loading');
      } else {
        fail('Persona.js missing memory loading integration');
      }

      if (personaCode.includes('generateEmbedding')) {
        pass('Persona.js imports embedding utilities');
      } else {
        fail('Persona.js missing embedding imports');
      }
    } catch (error) {
      fail('Failed to verify persona integration', error);
    }

    // Test 10: Conversation Integration Check
    section('10. Conversation Handler Integration');
    try {
      const fs = await import('fs');
      const conversationCode = fs.readFileSync('./lib/agents/conversation.js', 'utf8');

      if (conversationCode.includes('saveConversationSummary')) {
        pass('Conversation.js integrated with summary saving');
      } else {
        fail('Conversation.js missing summary saving integration');
      }

      if (conversationCode.includes('createConversationSummary')) {
        pass('Conversation.js imports summary utilities');
      } else {
        fail('Conversation.js missing summary imports');
      }
    } catch (error) {
      fail('Failed to verify conversation integration', error);
    }

    // Summary
    console.log(`\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);
    console.log(`${GREEN}Passed: ${passCount}${RESET}`);
    console.log(`${RED}Failed: ${failCount}${RESET}`);

    if (failCount === 0) {
      console.log(`\n${GREEN}🎉 ALL CHECKS PASSED!${RESET}`);
      console.log(`${GREEN}The pgvector memory system is fully operational.${RESET}\n`);
    } else {
      console.log(`\n${YELLOW}⚠️  Some checks failed. Review errors above.${RESET}\n`);
    }

    await closeConnection();
    process.exit(failCount === 0 ? 0 : 1);

  } catch (error) {
    console.error(`${RED}Fatal error during verification:${RESET}`, error);
    await closeConnection();
    process.exit(1);
  }
}

verify();
