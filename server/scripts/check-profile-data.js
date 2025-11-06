import { prisma } from '../lib/prisma-client.js';

async function checkProfileData() {
  try {
    const profile = await prisma.profile.findFirst({
      include: { user: { select: { email: true } } }
    });

    if (profile) {
      console.log('User:', profile.user.email);
      console.log('\nProfile Data Structure:');
      console.log(JSON.stringify(profile.data, null, 2));

      console.log('\n=== Available Fields ===');
      console.log('Skills:', profile.data.skills?.length || 0);
      console.log('Experiences:', profile.data.experiences?.length || 0);
      console.log('Education:', profile.data.education ? 'Yes' : 'No');
      console.log('Resume Text:', profile.data.resumeText ? `${profile.data.resumeText.substring(0, 100)}...` : 'No');
      console.log('Summary:', profile.data.summary ? 'Yes' : 'No');
    } else {
      console.log('No profiles found in database');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkProfileData();
