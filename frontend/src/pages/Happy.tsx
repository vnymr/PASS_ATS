import ChatInterface, { Message, ContentType } from '../components/ChatInterface';

export default function Happy() {
  // Mock data
  const mockJobs = [
    { title: 'Senior Product Designer', company: 'Apple Inc.', location: 'Cupertino, CA' },
    { title: 'UX Design Lead', company: 'Google', location: 'San Francisco, CA' },
    { title: 'Design Systems Engineer', company: 'Airbnb', location: 'Remote' },
    { title: 'Creative Director', company: 'Figma', location: 'New York, NY' },
  ];

  const mockRoutines = [
    { title: 'Morning Job Search', time: '9:00 AM', description: 'Review new job postings and update applications', completed: true },
    { title: 'LinkedIn Networking', time: '11:00 AM', description: 'Connect with 5 professionals in your field', completed: true },
    { title: 'Skill Development', time: '2:00 PM', description: 'Complete one course module or tutorial', completed: false },
    { title: 'Evening Follow-ups', time: '5:00 PM', description: 'Send thank you emails and check application status', completed: false },
  ];

  const mockProgress = [
    { title: 'Applications Sent', count: 24, total: 50, description: 'You\'re making great progress!' },
    { title: 'Profile Completion', count: 85, total: 100, description: 'Almost there, add 2 more skills' },
  ];

  const mockActions = [
    { title: 'Update Your Resume', description: 'Add your recent project experience to stand out', actionLabel: 'Update Now', priority: 'high' as const },
    { title: 'Practice Interview Questions', description: 'Review common questions for product design roles', actionLabel: 'Start Practice', priority: 'medium' as const },
    { title: 'Expand Your Network', description: 'Connect with alumni from your university', actionLabel: 'Find Alumni', priority: 'low' as const },
  ];

  const mockApplications = [
    { title: 'Senior UX Designer', company: 'Meta', location: 'Menlo Park, CA', appliedDate: 'Oct 28', status: 'interview' as const },
    { title: 'Product Designer', company: 'Stripe', location: 'San Francisco, CA', appliedDate: 'Oct 25', status: 'reviewing' as const },
    { title: 'Design Lead', company: 'Notion', location: 'Remote', appliedDate: 'Oct 22', status: 'pending' as const },
    { title: 'UI Designer', company: 'Dropbox', location: 'San Francisco, CA', appliedDate: 'Oct 20', status: 'rejected' as const },
  ];

  const analyzeQuery = (query: string): ContentType => {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('job') || lowerQuery.includes('position') || lowerQuery.includes('opening')) {
      return 'jobs';
    } else if (lowerQuery.includes('routine') || lowerQuery.includes('schedule') || lowerQuery.includes('daily')) {
      return 'routines';
    } else if (lowerQuery.includes('progress') || lowerQuery.includes('status') || lowerQuery.includes('how am i doing')) {
      return 'progress';
    } else if (lowerQuery.includes('applied') || lowerQuery.includes('application')) {
      return 'applications';
    } else if (lowerQuery.includes('what should i') || lowerQuery.includes('recommend') || lowerQuery.includes('next')) {
      return 'actions';
    }
    return 'overview';
  };

  const handleSubmit = async (message: string): Promise<Message> => {
    // Call backend API
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });

      if (response.ok) {
        const data = await response.json();
        const contentType = analyzeQuery(message);

        const aiResponse: Message = {
          type: 'ai',
          content: data.reply || '',
          contentType,
        };

        // Add mock data based on content type
        switch (contentType) {
          case 'jobs':
            aiResponse.content = 'I found these opportunities that match your profile:';
            aiResponse.jobs = mockJobs;
            break;
          case 'routines':
            aiResponse.content = 'Here\'s your personalized daily routine for job hunting:';
            aiResponse.routines = mockRoutines;
            break;
          case 'progress':
            aiResponse.content = 'Here\'s your current progress:';
            aiResponse.progress = mockProgress;
            break;
          case 'applications':
            aiResponse.content = 'Here are your recent job applications:';
            aiResponse.applications = mockApplications;
            break;
          case 'actions':
            aiResponse.content = 'Here are some recommended actions to boost your job search:';
            aiResponse.actions = mockActions;
            break;
          case 'overview':
            aiResponse.content = 'Here\'s your complete job search overview:';
            aiResponse.progress = mockProgress.slice(0, 1);
            aiResponse.applications = mockApplications.slice(0, 2);
            aiResponse.actions = mockActions.slice(0, 2);
            break;
          default:
            aiResponse.content = data.reply || 'I\'m here to help with your job search!';
        }

        return aiResponse;
      }
    } catch (error) {
      console.error('Error calling backend API:', error);
    }

    // Fallback response
    return {
      type: 'ai',
      content: 'I\'m here to help! Ask me about jobs, your daily routine, progress, applications, or what you should do next.',
      contentType: 'overview'
    };
  };

  return (
    <ChatInterface
      title="Ask me anything"
      onSubmit={handleSubmit}
      analyzeQuery={analyzeQuery}
      showDashboard={true}
    />
  );
}
