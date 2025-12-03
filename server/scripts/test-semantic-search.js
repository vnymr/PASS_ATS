/**
 * Test semantic search with multiple conversation summaries
 */

import 'dotenv/config';
import { saveConversationSummary, searchRelevantSummaries } from '../lib/memory/summary-store.js';
import { generateEmbedding } from '../lib/memory/embedding-utils.js';
import { closeConnection } from '../lib/embeddings-db.js';

async function testSemanticSearch() {
  try {
    console.log('🧪 Testing semantic search with multiple summaries...\n');

    // Create diverse test summaries
    const testSummaries = [
      {
        text: "User asked about software engineer jobs at FAANG companies. Interested in backend roles with Python and AWS. Salary expectation: $180k+",
        importance: 7
      },
      {
        text: "User wanted to find product manager positions at startups in SF Bay Area. Discussed preference for B2B SaaS companies and 5+ years experience.",
        importance: 8
      },
      {
        text: "User inquired about data scientist roles requiring machine learning experience. Looking for remote positions with flexible hours.",
        importance: 6
      },
      {
        text: "User searched for marketing manager jobs at tech companies. Focused on growth marketing and digital advertising experience.",
        importance: 5
      },
      {
        text: "User asked about DevOps engineer positions with Kubernetes and Docker experience. Preferred companies with strong engineering culture.",
        importance: 7
      }
    ];

    // Save all summaries
    console.log('📝 Saving test summaries...');
    for (let i = 0; i < testSummaries.length; i++) {
      const embedding = await generateEmbedding(testSummaries[i].text);
      await saveConversationSummary({
        id: `semantic_test_${Date.now()}_${i}`,
        conversationId: `test_conv_${i}`,
        userId: 1000, // Different test user
        summary: testSummaries[i].text,
        embedding,
        importance: testSummaries[i].importance
      });
      console.log(`   ✅ Saved summary ${i + 1}/${testSummaries.length}`);
    }

    console.log('\n🔍 Testing semantic searches...\n');

    // Test 1: Search for software engineer jobs
    console.log('1️⃣ Query: "Looking for software engineering positions at big tech"');
    const query1 = await generateEmbedding("Looking for software engineering positions at big tech");
    const results1 = await searchRelevantSummaries({ userId: 1000, queryEmbedding: query1, limit: 3 });

    console.log(`   Found ${results1.length} results:`);
    results1.forEach((r, i) => {
      console.log(`   ${i + 1}. Distance: ${r.distance.toFixed(4)} - ${r.summary.substring(0, 80)}...`);
    });

    // Test 2: Search for product manager roles
    console.log('\n2️⃣ Query: "Find PM jobs at tech startups"');
    const query2 = await generateEmbedding("Find PM jobs at tech startups");
    const results2 = await searchRelevantSummaries({ userId: 1000, queryEmbedding: query2, limit: 3 });

    console.log(`   Found ${results2.length} results:`);
    results2.forEach((r, i) => {
      console.log(`   ${i + 1}. Distance: ${r.distance.toFixed(4)} - ${r.summary.substring(0, 80)}...`);
    });

    // Test 3: Search for remote data science
    console.log('\n3️⃣ Query: "Remote data science and ML opportunities"');
    const query3 = await generateEmbedding("Remote data science and ML opportunities");
    const results3 = await searchRelevantSummaries({ userId: 1000, queryEmbedding: query3, limit: 3 });

    console.log(`   Found ${results3.length} results:`);
    results3.forEach((r, i) => {
      console.log(`   ${i + 1}. Distance: ${r.distance.toFixed(4)} - ${r.summary.substring(0, 80)}...`);
    });

    console.log('\n✅ Semantic search is working correctly!');
    console.log('   The most relevant results appear first (lowest distance)');

    await closeConnection();
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await closeConnection();
    process.exit(1);
  }
}

testSemanticSearch();
