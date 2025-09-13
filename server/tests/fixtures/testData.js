export const testUsers = {
  validUser: {
    email: 'test@example.com',
    password: 'TestPassword123!',
    name: 'Test User'
  },
  adminUser: {
    email: 'admin@example.com',
    password: 'AdminPass456!',
    name: 'Admin User'
  },
  invalidUser: {
    email: 'invalid-email',
    password: '123',
    name: ''
  }
};

export const testProfiles = {
  completeProfile: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-0123',
    location: 'San Francisco, CA',
    portfolio: 'https://johndoe.com',
    github: 'https://github.com/johndoe',
    linkedin: 'https://linkedin.com/in/johndoe',
    summary: 'Experienced software engineer with 5+ years in full-stack development',
    experience: [
      {
        title: 'Senior Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        startDate: '2020-01',
        endDate: 'Present',
        description: 'Led development of microservices architecture'
      }
    ],
    education: [
      {
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        school: 'Stanford University',
        location: 'Stanford, CA',
        graduationDate: '2018-05'
      }
    ],
    skills: ['JavaScript', 'Python', 'React', 'Node.js', 'AWS'],
    certifications: [
      {
        name: 'AWS Solutions Architect',
        issuer: 'Amazon Web Services',
        date: '2022-03'
      }
    ]
  },
  minimalProfile: {
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '+1-555-9876'
  }
};

export const testJobDescriptions = {
  seniorEngineer: {
    title: 'Senior Software Engineer',
    company: 'Big Tech Company',
    description: `
      We are looking for a Senior Software Engineer to join our team.
      
      Requirements:
      - 5+ years of experience in software development
      - Strong knowledge of JavaScript, React, and Node.js
      - Experience with AWS or other cloud platforms
      - Excellent problem-solving skills
      - Experience with microservices architecture
      
      Nice to have:
      - Python experience
      - Machine learning knowledge
      - Open source contributions
    `,
    priority: ['JavaScript', 'React', 'Node.js', 'AWS', 'microservices'],
    optional: ['Python', 'Machine Learning', 'Open Source']
  },
  dataScientist: {
    title: 'Data Scientist',
    company: 'Analytics Corp',
    description: `
      Looking for a Data Scientist to analyze complex datasets.
      
      Requirements:
      - Python and R programming
      - Machine Learning and Deep Learning
      - Statistics and Mathematics
      - SQL and NoSQL databases
      - Data visualization tools
    `,
    priority: ['Python', 'Machine Learning', 'Statistics', 'SQL'],
    optional: ['R', 'Deep Learning', 'Tableau']
  }
};

export const testResumes = {
  goldStandard: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-0123',
    location: 'San Francisco, CA',
    summary: 'Senior Software Engineer with 5+ years of experience in developing scalable web applications using JavaScript, React, and Node.js. Proven expertise in AWS cloud services and microservices architecture.',
    experience: [
      {
        title: 'Senior Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        startDate: 'January 2020',
        endDate: 'Present',
        bullets: [
          'Led development of microservices architecture serving 1M+ users',
          'Implemented React-based frontend with 40% performance improvement',
          'Deployed applications on AWS using EC2, S3, and Lambda',
          'Mentored team of 5 junior developers'
        ]
      }
    ],
    education: [
      {
        degree: 'Bachelor of Science in Computer Science',
        school: 'Stanford University',
        location: 'Stanford, CA',
        graduationDate: 'May 2018'
      }
    ],
    skills: {
      technical: ['JavaScript', 'React', 'Node.js', 'AWS', 'Python', 'Docker', 'Kubernetes'],
      soft: ['Leadership', 'Problem Solving', 'Communication', 'Team Collaboration']
    },
    certifications: [
      {
        name: 'AWS Solutions Architect Associate',
        issuer: 'Amazon Web Services',
        date: 'March 2022'
      }
    ]
  }
};

export const mockOpenAIResponses = {
  resumeGeneration: {
    success: {
      choices: [{
        message: {
          content: JSON.stringify({
            summary: 'Experienced software engineer with expertise in full-stack development',
            experience: [
              {
                bullets: [
                  'Developed scalable microservices handling 1M+ requests daily',
                  'Improved application performance by 40% through optimization',
                  'Led cross-functional team of 8 engineers'
                ]
              }
            ],
            skills: ['JavaScript', 'React', 'Node.js', 'AWS'],
            tailoredSections: {
              achievements: [
                'Reduced deployment time by 60% through CI/CD automation',
                'Achieved 99.9% uptime for critical services'
              ]
            }
          })
        }
      }]
    },
    error: {
      error: {
        message: 'API rate limit exceeded',
        type: 'rate_limit_error',
        code: 'rate_limit_exceeded'
      }
    }
  },
  profileAnalysis: {
    success: {
      choices: [{
        message: {
          content: JSON.stringify({
            summary: 'Experienced professional with strong technical background',
            strengths: ['Leadership', 'Technical expertise', 'Problem solving'],
            improvements: ['Add more quantifiable achievements', 'Include relevant certifications'],
            score: 85
          })
        }
      }]
    }
  }
};

export const testPDFMetadata = {
  expectedChecksum: 'a1b2c3d4e5f6g7h8i9j0',
  expectedSize: 45678,
  allowedSizeDelta: 500, // Allow 500 bytes difference for timestamps
  expectedPages: 2,
  expectedFonts: ['Helvetica', 'Helvetica-Bold'],
  expectedAuthor: 'PASS ATS System',
  expectedCreator: 'PASS Resume Generator v1.0'
};

export const testSSEEvents = {
  jobStart: {
    type: 'start',
    message: 'Starting resume generation',
    progress: 0
  },
  jobProgress: {
    type: 'progress',
    message: 'Analyzing job description',
    progress: 25
  },
  jobComplete: {
    type: 'complete',
    message: 'Resume generated successfully',
    progress: 100,
    data: {
      resumeUrl: '/output/test-resume.json',
      pdfUrl: '/output/test-resume.pdf'
    }
  },
  jobError: {
    type: 'error',
    message: 'Failed to generate resume',
    error: 'OpenAI API error'
  }
};