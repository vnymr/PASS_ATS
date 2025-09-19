import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000';

// Test data matching exactly what the frontend sends
const testData = {
  aiMode: "fast",
  company: "HumCap is seeking an exceptional Sales Executive to expand our client base and deliver our premium Human Resources and Recruiting Services",
  jobDescription: `Sales Executive
Plano, TX · 2 weeks ago · Over 100 applicants
Promoted by hirer · Actively reviewing applicants


On-site

Full-time

Easy Apply

Save
Save Sales Executive  at HumCap
Sales Executive
HumCap · Plano, TX (On-site)

Easy Apply

Save
Save Sales Executive  at HumCap
Show more options
Your profile is missing required qualifications


Show match details

Help me update my profile


BETA

Is this information helpful?



Get personalized tips to stand out to hirers
Find jobs where you're a top applicant and tailor your resume with the help of AI.

Reactivate Premium
People you can reach out to
The University of Texas at Dallas logo
The University of Texas at Dallas logo
School alumni from The University of Texas at Dallas

Show all
Meet the hiring team
Amy Schmidt
Amy Schmidt
 2nd
Genuine People-Person and Connector; Facilitator; Cheerleader; I enjoy supporting others to success and growth, advocating for others, and organizing and facilitating great experiences. Educator and Learner Advocate
Job poster · 3 mutual connections

Message
About the job
Account Executive/Sales



Plano, TX | On-Site

HumCap is seeking an exceptional Sales Executive to expand our client base and deliver our premium Human Resources and Recruiting Services throughout DFW and beyond. If you're a proven sales professional with a consistent record of exceeding targets and possess a robust professional network eager for innovative HR solutions, this role offers tremendous opportunity for growth and impact.
Qualifications & Experience

Bachelor's Degree required
Demonstrated success with 5+ years in sales/business development
Proven experience (2+ years minimum) selling intangible services and solutions
Experience with Human Resources service sales (consulting, payroll, PEO, benefits, HRIS) or Recruiting Services highly valued
Strong preference for candidates established in the DFW Metroplex with local networks
Key Responsibilities

Leverage and expand your professional network to develop and qualify high-potential sales leads
Build strategic relationships with decision-makers, hiring managers, and key referral partners
Secure and conduct impactful sales presentations with executive-level prospects
Provide consultative expertise, craft compelling proposals, and negotiate favorable contracts
Foster collaborative partnerships with internal recruiting teams to ensure client success
Independently generate new business opportunities while maximizing existing company leads
Implement consultative selling approaches to align solutions with client needs and expectations
Maintain disciplined follow-up processes with prospects and clients
Actively participate in industry networking events to increase brand visibility and opportunity pipeline`,
  matchMode: "balanced",
  resumeText: `Vinay Muthareddy Dallas, TX  945-244-7733 # i.vinaymr@gmail.com ï linkedin.com/in/ivinaymr  vinaymuthareddy.com Professional Summary Technical Product Manager and AI Engineer with a proven track record of founding and scaling AI-driven SaaS and consumer products from 0 to 1. Expert in building innovative solutions usingLangChain,LangGraph, AI frameworks,React, and MongoDB, with hands-on experience in agent development and machine learning models. Skilled inmarket research, Jira-driven agile workflows, and leveragingSQLandTableauto drive user engagement and business growth. Adept at leading cross-functional teams and delivering data-informed product strategies. Experience Technical Product Manager, AI Engineer & FounderSep 2024 – Present Happyspace (SaaS Marketing Platform)Dallas, TX –Founded and scaled a SaaS marketing platform from 0 to 1, building an AI-powered solution withReactandMongoDB, serving 200+ SMB clients with 99.8% uptime. –Developed an AI agent usingLangChain,LangGraph,Pydantic, andOpenAI SDKfor tool calling and NLP tasks, automating 30% of user workflows and enhancing consumer engagement. –Ledmarket research(50+ interviews), definingOKR-based roadmap and KPIs, boosting conversions by25%and user acquisition by30%. –Managed data platform for stock analysis withPython,TensorFlow,SQL, andPostgreSQL, processing 10,000+ records with data transformations and governance. –Set upCI/CDwithDockerandJenkinsfor data workflows, cutting release cycles by40%. –Analyzed 50,000+ user interactions withSQLandTableau, reducing campaign costs by20%through data-driven optimizations. –Created technical requirements and user stories for engineering and data teams, ensuring clarity in sprint planning and UAT for 10+ features, collaborating with stakeholders to align on priorities. –Managed 10-person team viaJira, prioritizing backlogs based on impact, aligning with business goals. AI Engineer, Product Manager & FounderSep 2023 – Sep 2024 Workgallery (SaaS Recruitment Platform)Dallas, TX –Founded and scaled a SaaS recruitment platform from 0 to 1, developing a consumer-facing solution withReactand MongoDB, achieving 600+ sign-ups in week one and 90% user satisfaction. –Conductedmarket research(300+ students), iterating UI/UX to increase retention by35%viaTableauinsights on 20,000+ data points. –Engineered AI data extraction withPythonandSQL, cutting processing time by50%for recruiter workflows across 5,000+ profiles. –Collaborated with enterprise clients to integrate scalable APIs usingGCPandDocker, ensuring seamless data workflows and clear communication. –Deployed onAWSwithDocker, ensuring 99.9% uptime; acted as thought partner to engineering, balancing requirements with scope. –Defined system architecture for scalability, handling 1,000+ concurrent users withNode.jsbackend andPostgreSQL database. –Led agile sprints viaJira, delivering 15+ innovative features with a 16-person team, including effort estimation and UAT. Skills Languages:Python, SQL, JavaScriptAI Frameworks/Tools:LangChain, LangGraph, Pydantic, OpenAI SDK, TensorFlow, MCP ServerFrameworks/Tools:React, Node.js, Docker, CI/CD (Jenkins), Jira Databases/Cloud:MongoDB, PostgreSQL, AWS (EC2, S3), GCPData Visualization:Tableau Product Management:Market Research, OKRs, Agile/Scrum, Cross-Functional Leadership, User Stories AI Engineering:Agent Development, Model Development, Scalable Deployments, NLPBackground:Computer Science Fundamentals Projects Stock Market Analysis Tool (Fintech)May 2023 – Aug 2023 Personal ProjectDallas, TX –Built AI system withPython,TensorFlow,SQL, andPostgreSQL, processing 10,000+ records via real-time APIs. –Optimized ML models for stock pattern recognition, achieving85%accuracy; deployed onGCPwithDocker. –Visualized trends viaTableau, enabling actionable portfolio insights for 500+ simulated users. Education University of Texas at DallasAug 2022 – May 2024 M.S. in Information Technology & ManagementDallas, TX`,
  role: "Sales Executive"
};

// First, we need to register and login to get a token
async function registerAndLogin() {
  try {
    // Use a unique email for this test run
    const timestamp = Date.now();
    const email = `test${timestamp}@example.com`;
    const password = 'Test123!@#';

    // Try to register first
    console.log(`Attempting to register new user: ${email}...`);
    const registerRes = await fetch(`${API_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        password: password,
        name: 'Test User'
      })
    });

    if (registerRes.ok) {
      const data = await registerRes.json();
      console.log('✅ Registered and logged in successfully');
      return data.token;
    }

    // If registration fails, try logging in (shouldn't happen with unique email)
    console.log('Registration failed, attempting to login...');
    const loginRes = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed: ${await loginRes.text()}`);
    }

    const data = await loginRes.json();
    console.log('✅ Logged in successfully');
    return data.token;
  } catch (error) {
    console.error('Auth error:', error);
    throw error;
  }
}

async function testGenerateEndpoint() {
  console.log('🚀 Starting API test for /api/generate endpoint\n');

  try {
    // Step 1: Get authentication token
    const token = await registerAndLogin();
    console.log(`Token obtained: ${token.substring(0, 20)}...`);

    // Step 2: Test the generate endpoint
    console.log('\n📤 Sending request to /api/generate...');
    console.log('Request body:', JSON.stringify(testData, null, 2).substring(0, 500) + '...');

    const response = await fetch(`${API_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(testData)
    });

    console.log(`\n📥 Response status: ${response.status} ${response.statusText}`);

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Error response:', result);
      return;
    }

    console.log('✅ Success! Job created:', result);

    // Step 3: Poll for job status
    if (result.jobId) {
      console.log(`\n🔄 Polling job status for job ID: ${result.jobId}`);
      await pollJobStatus(token, result.jobId);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function pollJobStatus(token, jobId) {
  const maxAttempts = 60; // Poll for up to 60 seconds
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${API_URL}/api/job/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error(`Failed to fetch job status: ${response.status}`);
        break;
      }

      const job = await response.json();
      console.log(`Job status: ${job.status}`);

      if (job.status === 'COMPLETED') {
        console.log('✅ Job completed successfully!');

        // Try to get the PDF
        const pdfResponse = await fetch(`${API_URL}/api/job/${jobId}/download/pdf`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (pdfResponse.ok) {
          console.log('✅ PDF generated successfully!');
          console.log(`PDF size: ${pdfResponse.headers.get('content-length')} bytes`);
        } else {
          console.log('❌ Failed to download PDF');
        }
        break;
      } else if (job.status === 'FAILED') {
        console.error('❌ Job failed:', job.error);
        break;
      }

      // Wait 1 second before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    } catch (error) {
      console.error('Error polling job status:', error);
      break;
    }
  }

  if (attempts >= maxAttempts) {
    console.log('⏱️ Polling timeout - job is still processing');
  }
}

// Run the test
testGenerateEndpoint().catch(console.error);