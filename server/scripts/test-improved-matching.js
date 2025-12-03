/**
 * Test script to verify improved job matching system
 * Tests comprehensive skill extraction and matching
 */

import { prisma } from '../lib/prisma-client.js';
import jobRecommendationEngine from '../lib/job-recommendation-engine.js';
import { extractAllSkillsFromProfile } from '../lib/profile-skill-extractor.js';
import logger from '../lib/logger.js';

async function testImprovedMatching() {
  try {
    console.log('=== Testing Improved Job Matching System ===\n');

    // 1. Get a user profile
    const user = await prisma.user.findFirst({
      include: { profile: true }
    });

    if (!user || !user.profile) {
      console.log('❌ No user profile found. Please create a profile first.');
      return;
    }

    console.log(`✓ Testing with user: ${user.email}`);
    console.log(`User ID: ${user.id}\n`);

    // 2. Test comprehensive skill extraction
    console.log('📊 Testing Comprehensive Skill Extraction...');
    const profileData = user.profile.data;

    console.log('\nOriginal Profile Data:');
    console.log(`- Explicit skills: ${profileData.skills?.length || 0}`);
    console.log(`- Experiences: ${profileData.experiences?.length || 0}`);
    console.log(`- Education: ${profileData.education?.length || 0}`);

    const skillAnalysis = await extractAllSkillsFromProfile(profileData);

    console.log('\n✓ Enhanced Skill Analysis:');
    console.log(`- Core technical skills: ${skillAnalysis.coreSkills.length}`);
    console.log(`  ${skillAnalysis.coreSkills.slice(0, 10).join(', ')}${skillAnalysis.coreSkills.length > 10 ? '...' : ''}`);
    console.log(`- All skills extracted: ${skillAnalysis.allSkills.length}`);
    console.log(`  ${skillAnalysis.allSkills.slice(0, 15).join(', ')}${skillAnalysis.allSkills.length > 15 ? '...' : ''}`);
    console.log(`- Soft skills: ${skillAnalysis.softSkills.length}`);
    console.log(`  ${skillAnalysis.softSkills.join(', ')}`);
    console.log(`- Domain expertise: ${skillAnalysis.domains.length}`);
    console.log(`  ${skillAnalysis.domains.join(', ')}`);
    console.log(`- Total years of experience: ${skillAnalysis.totalYearsExperience}`);
    console.log(`- Seniority level: ${skillAnalysis.seniorityLevel}`);

    console.log('\n📋 Skills with experience context:');
    const topSkills = Object.entries(skillAnalysis.skillsWithExperience)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    topSkills.forEach(([skill, years]) => {
      console.log(`  - ${skill}: ${years.toFixed(1)} years`);
    });

    // 3. Get job recommendations
    console.log('\n\n🎯 Testing Job Recommendations...');
    const recommendations = await jobRecommendationEngine.getRecommendations(user.id, {
      limit: 5
    });

    if (!recommendations.jobs || recommendations.jobs.length === 0) {
      console.log('❌ No jobs found. Please populate jobs first.');
      return;
    }

    console.log(`\n✓ Found ${recommendations.jobs.length} recommended jobs`);
    console.log(`Total jobs analyzed: ${recommendations.total}\n`);

    // 4. Show detailed scoring for top 3 jobs
    console.log('📈 Detailed Scoring for Top 3 Jobs:\n');
    recommendations.jobs.slice(0, 3).forEach((job, idx) => {
      console.log(`${idx + 1}. ${job.title} at ${job.company}`);
      console.log(`   Overall Score: ${(job.relevanceScore * 100).toFixed(1)}%`);

      if (job.scoreBreakdown) {
        console.log('   Score Breakdown:');
        console.log(`   - Keyword Match: ${(job.scoreBreakdown.keywordMatch * 100).toFixed(1)}%`);
        console.log(`   - Required Skills: ${(job.scoreBreakdown.requiredSkillsMatch * 100).toFixed(1)}%`);
        console.log(`   - Experience Match: ${(job.scoreBreakdown.experienceMatch * 100).toFixed(1)}%`);
        console.log(`   - Location: ${(job.scoreBreakdown.locationMatch * 100).toFixed(1)}%`);
      }

      console.log(`   Job Details:`);
      console.log(`   - Location: ${job.location || 'N/A'}`);
      console.log(`   - Experience: ${job.extractedExperience || 'N/A'}`);
      console.log(`   - Skills: ${job.extractedSkills?.length || 0} skills extracted`);
      if (job.extractedSkills && job.extractedSkills.length > 0) {
        console.log(`     ${job.extractedSkills.slice(0, 10).join(', ')}${job.extractedSkills.length > 10 ? '...' : ''}`);
      }
      console.log('');
    });

    // 5. Compare old vs new extraction
    console.log('\n📊 Comparison: Old vs New System');
    console.log('─'.repeat(60));
    console.log('Old System:');
    console.log(`  - Only used ${profileData.skills?.length || 0} explicit skills`);
    console.log(`  - Limited job skill extraction (max 20 skills)`);
    console.log(`  - Basic keyword matching only`);
    console.log(`  - No experience context weighting`);
    console.log('\nNew System:');
    console.log(`  - Extracts ${skillAnalysis.allSkills.length} skills from entire profile`);
    console.log(`  - Unlimited job skill extraction`);
    console.log(`  - Experience-weighted keyword matching`);
    console.log(`  - Years of experience per skill tracking`);
    console.log(`  - Soft skills and domain expertise matching`);
    console.log(`  - Enhanced experience matching (level + years)`);
    console.log('─'.repeat(60));

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testImprovedMatching();
