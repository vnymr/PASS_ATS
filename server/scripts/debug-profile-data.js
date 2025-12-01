#!/usr/bin/env node
/**
 * Debug script to check what profile data is passed to AI
 */

import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../lib/prisma-client.js';

async function main() {
  console.log('=== Profile Data Debug ===\n');

  // Get a sample profile (first one with data)
  const profiles = await prisma.profile.findMany({
    take: 3,
    where: {
      data: { not: null }
    },
    select: {
      userId: true,
      data: true,
      updatedAt: true
    }
  });

  if (profiles.length === 0) {
    console.log('No profiles found with data.');
    process.exit(0);
  }

  for (const profile of profiles) {
    console.log(`\n=== User ID: ${profile.userId} ===`);
    console.log(`Updated: ${profile.updatedAt}`);

    const data = profile.data;
    if (!data) {
      console.log('No data in profile');
      continue;
    }

    console.log('\n📋 Profile Structure:');
    console.log('─'.repeat(50));

    // Check basic info
    console.log(`\n👤 PERSONAL INFO:`);
    console.log(`   name: ${data.name || data.personalInfo?.name || '❌ MISSING'}`);
    console.log(`   email: ${data.email || data.personalInfo?.email || '❌ MISSING'}`);
    console.log(`   phone: ${data.phone || data.personalInfo?.phone || '(not provided)'}`);
    console.log(`   location: ${data.location || data.personalInfo?.location || '(not provided)'}`);
    console.log(`   linkedin: ${data.linkedin || data.personalInfo?.linkedin || '(not provided)'}`);
    console.log(`   github: ${data.github || data.personalInfo?.github || '(not provided)'}`);

    // Check experiences
    const experiences = data.experiences || data.experience || [];
    console.log(`\n💼 EXPERIENCES: ${experiences.length} entries`);
    if (experiences.length > 0) {
      experiences.slice(0, 2).forEach((exp, i) => {
        console.log(`   [${i + 1}] ${exp.role || exp.title || exp.position || '?'} at ${exp.company || '?'}`);
        console.log(`       Dates: ${exp.dates || exp.startDate || '?'} - ${exp.endDate || 'Present'}`);
        console.log(`       Bullets: ${(exp.bullets || exp.responsibilities || exp.description || []).length} items`);
      });
      if (experiences.length > 2) {
        console.log(`   ... and ${experiences.length - 2} more`);
      }
    } else {
      console.log('   ❌ NO EXPERIENCES');
    }

    // Check skills
    const skills = data.skills || [];
    console.log(`\n🔧 SKILLS: ${skills.length} items`);
    if (skills.length > 0) {
      console.log(`   ${skills.slice(0, 10).join(', ')}${skills.length > 10 ? '...' : ''}`);
    } else {
      console.log('   ❌ NO SKILLS');
    }

    // Check education
    const education = data.education || [];
    console.log(`\n🎓 EDUCATION: ${education.length} entries`);
    if (education.length > 0) {
      education.forEach((edu, i) => {
        console.log(`   [${i + 1}] ${edu.degree || '?'} - ${edu.institution || edu.school || '?'}`);
      });
    }

    // Check projects
    const projects = data.projects || [];
    console.log(`\n📂 PROJECTS: ${projects.length} entries`);

    // Check certifications
    const certifications = data.certifications || [];
    console.log(`\n📜 CERTIFICATIONS: ${certifications.length} entries`);

    // Check resumeText
    console.log(`\n📄 RESUME TEXT: ${data.resumeText ? `${data.resumeText.length} chars` : '❌ MISSING'}`);

    // Check additionalInfo
    console.log(`📝 ADDITIONAL INFO: ${data.additionalInfo ? `${data.additionalInfo.length} chars` : '(none)'}`);

    // Check for nested data
    if (data.fullData) {
      console.log(`\n⚠️  HAS fullData: ${Object.keys(data.fullData).join(', ')}`);
    }
    if (data.processedAdditionalInfo) {
      console.log(`⚠️  HAS processedAdditionalInfo: ${Object.keys(data.processedAdditionalInfo).join(', ')}`);
    }

    // Summary
    console.log('\n' + '─'.repeat(50));
    console.log('📊 SUMMARY:');
    const hasName = !!(data.name || data.personalInfo?.name);
    const hasEmail = !!(data.email || data.personalInfo?.email);
    const hasExperience = experiences.length > 0;
    const hasSkills = skills.length > 0;
    const hasEducation = education.length > 0;

    console.log(`   Ready for resume: ${hasName && hasEmail && (hasExperience || hasSkills) ? '✅ YES' : '❌ NO'}`);
    console.log(`   Missing: ${[
      !hasName && 'name',
      !hasEmail && 'email',
      !hasExperience && 'experience',
      !hasSkills && 'skills'
    ].filter(Boolean).join(', ') || 'nothing critical'}`);

    // Show raw data size
    console.log(`\n📦 RAW DATA SIZE: ${JSON.stringify(data).length} chars`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
