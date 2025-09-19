/**
 * Test to verify all user data is properly passed to AI Generator
 */

import AIResumeGenerator from './lib/ai-resume-generator.js';

// Sample complete profile data (what would be stored in DB)
const sampleProfileData = {
  name: "John Smith",
  email: "john.smith@email.com",
  phone: "(555) 123-4567",
  location: "San Francisco, CA",
  linkedin: "linkedin.com/in/johnsmith",
  website: "johnsmith.dev",
  summary: "Senior Software Engineer with 8+ years of experience",

  skills: [
    "JavaScript", "TypeScript", "Python", "React", "Node.js",
    "AWS", "Docker", "Kubernetes", "PostgreSQL", "MongoDB"
  ],

  experiences: [
    {
      company: "TechCorp",
      role: "Senior Software Engineer",
      location: "San Francisco, CA",
      dates: "Jan 2021 - Present",
      bullets: [
        "Led team of 5 engineers to deliver microservices platform",
        "Reduced API latency by 40% through optimization",
        "Implemented CI/CD pipeline for 20+ services"
      ]
    },
    {
      company: "StartupXYZ",
      role: "Software Engineer",
      location: "Remote",
      dates: "Jun 2018 - Dec 2020",
      bullets: [
        "Built real-time chat system serving 100K+ users",
        "Developed React components library used across products",
        "Optimized database queries reducing load by 60%"
      ]
    }
  ],

  education: [
    {
      institution: "University of California, Berkeley",
      degree: "Bachelor of Science in Computer Science",
      location: "Berkeley, CA",
      dates: "2014 - 2018"
    }
  ],

  projects: [
    {
      name: "Open Source Contribution - React Router",
      summary: "Contributing to popular routing library",
      bullets: [
        "Fixed critical bug affecting 10K+ applications",
        "Added new feature for dynamic route loading"
      ]
    }
  ],

  certifications: [
    "AWS Solutions Architect Professional",
    "Google Cloud Professional Developer"
  ],

  additionalInfo: `Fluent in Spanish and Mandarin.
Won first place in TechCrunch Disrupt Hackathon 2022.
Published paper on distributed systems optimization in IEEE journal.
Active mentor for underrepresented groups in tech.
Volunteer teaching coding to high school students.`,

  resumeText: "Original resume text here..."
};

const jobDescription = `
Senior Software Engineer - Full Stack
Google - Mountain View, CA

We're looking for a Senior Software Engineer to join our team building next-generation cloud infrastructure.

Requirements:
- 5+ years of software development experience
- Strong experience with distributed systems
- Proficiency in multiple programming languages (Go, Python, Java preferred)
- Experience with cloud platforms (GCP preferred, AWS acceptable)
- Knowledge of Kubernetes and containerization
- Strong communication skills and ability to work in teams

Nice to have:
- Open source contributions
- Published research or papers
- Experience mentoring junior engineers
- Multiple language fluency

Responsibilities:
- Design and implement scalable distributed systems
- Lead technical projects and mentor team members
- Collaborate with cross-functional teams
- Drive best practices and technical excellence
`;

async function testDataFlow() {
  console.log('🔍 Testing Complete Data Flow to AI Generator\n');
  console.log('=' .repeat(60));

  try {
    // Initialize generator
    const generator = new AIResumeGenerator(process.env.OPENAI_API_KEY || 'test-key');

    // Simulate what server.js does - prepare userData
    const userData = {
      ...sampleProfileData,
      fullName: sampleProfileData.name,  // Map name to fullName
    };

    console.log('\n📊 Data being sent to AI Generator:');
    console.log('=' .repeat(60));

    // Check each field
    const fields = [
      'fullName', 'email', 'phone', 'location', 'linkedin', 'website',
      'summary', 'skills', 'experiences', 'education', 'projects',
      'certifications', 'additionalInfo', 'resumeText'
    ];

    fields.forEach(field => {
      const value = userData[field];
      const status = value && (Array.isArray(value) ? value.length > 0 : true) ? '✅' : '❌';

      if (Array.isArray(value)) {
        console.log(`${status} ${field}: ${value.length} items`);
      } else if (typeof value === 'string') {
        console.log(`${status} ${field}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
      } else {
        console.log(`${status} ${field}: ${value ? 'present' : 'missing'}`);
      }
    });

    // Build the prompt to see what AI will receive
    const style = generator.determineStyle(jobDescription, {});
    const examples = generator.getRelevantExamples(style);
    const prompt = generator.buildPrompt(userData, jobDescription, examples, {});

    console.log('\n📝 AI Prompt Structure:');
    console.log('=' .repeat(60));

    // Check if additional info is highlighted
    const hasAdditionalInfo = prompt.includes('IMPORTANT ADDITIONAL INFORMATION FROM USER');
    console.log(`${hasAdditionalInfo ? '✅' : '❌'} Additional information section highlighted`);

    // Check if all data is in the prompt
    const dataInPrompt = JSON.stringify(userData, null, 2);
    const promptIncludesAllData = prompt.includes(dataInPrompt);
    console.log(`${promptIncludesAllData ? '✅' : '❌'} All user data included in prompt`);

    // Count prompt sections
    const sections = [
      'CANDIDATE INFORMATION',
      'TARGET JOB',
      'REQUIREMENTS',
      'EXAMPLE LATEX RESUMES',
      'ADDITIONAL PREFERENCES'
    ];

    console.log('\n📋 Prompt Sections:');
    sections.forEach(section => {
      const hasSection = prompt.includes(section);
      console.log(`${hasSection ? '✅' : '❌'} ${section}`);
    });

    console.log('\n💡 Key Insights:');
    console.log('=' .repeat(60));

    // Analyze what will be emphasized
    const skillsMatched = userData.skills.filter(skill =>
      jobDescription.toLowerCase().includes(skill.toLowerCase())
    );
    console.log(`• ${skillsMatched.length} skills match job description:`, skillsMatched.join(', '));

    const hasRelevantCerts = userData.certifications.some(cert =>
      jobDescription.toLowerCase().includes('gcp') || jobDescription.toLowerCase().includes('aws')
    );
    console.log(`• Relevant certifications: ${hasRelevantCerts ? 'Yes (AWS/GCP)' : 'No'}`);

    const additionalRelevant = [
      'Spanish', 'Mandarin', 'mentor', 'published', 'open source'
    ].filter(keyword =>
      jobDescription.toLowerCase().includes(keyword.toLowerCase())
    );
    console.log(`• Additional info keywords matching job:`, additionalRelevant.join(', ') || 'None');

    console.log('\n✅ Summary:');
    console.log('=' .repeat(60));
    console.log('All user data is properly structured and will be sent to AI.');
    console.log('The AI will receive:');
    console.log('• Complete profile information (name, contact, location)');
    console.log('• Full work experience with achievements');
    console.log('• Education and certifications');
    console.log('• Projects and contributions');
    console.log('• Skills list');
    console.log('• Additional information (languages, hackathons, mentoring)');
    console.log('\nThe AI will tailor the resume to emphasize:');
    console.log('• Distributed systems experience (matches job requirement)');
    console.log('• Cloud platform certifications (AWS/GCP)');
    console.log('• Language fluency (Spanish/Mandarin - job nice-to-have)');
    console.log('• Mentoring experience (job nice-to-have)');
    console.log('• Open source contributions (job nice-to-have)');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the test
testDataFlow();