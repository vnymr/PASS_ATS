# Frontend API Integration Guide - Chat & Autonomous Features

**Base URL**: `http://localhost:3000/api` (Development)
**Production URL**: TBD

## 🔐 Authentication

All endpoints require authentication via Bearer token in the header:
```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

### 1. Register User
```
POST /api/register
```

**Body**:
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

### 2. Login
```
POST /api/login
```

**Body**:
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

---

## 💬 Chat Interface (PRIMARY ENDPOINT)

### 3. Send Message to AI
```
POST /api/chat
```

**THIS IS THE MAIN ENDPOINT FOR THE CHAT INTERFACE**

**Headers**:
```javascript
{
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

**Body**:
```json
{
  "message": "I want to find a product manager job",
  "conversationId": "optional-conversation-id",
  "metadata": {}
}
```

**Response**: Server-Sent Events (SSE) stream

**How to consume SSE in React**:
```javascript
const sendMessage = async (message, conversationId) => {
  const response = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message,
      conversationId: conversationId || null
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.substring(6).trim();
        if (data && data !== '[DONE]') {
          try {
            const json = JSON.parse(data);

            // Handle different event types
            if (json.type === 'text') {
              // Text chunk from AI - append to message
              appendToMessage(json.content);
            }

            if (json.type === 'action') {
              // Tool execution result
              console.log('Tool executed:', json.name, json.payload);
              displayToolResult(json.name, json.payload);
            }

            if (json.type === 'error') {
              // Error occurred
              showError(json.message);
            }

            if (json.type === 'done') {
              // Message complete
              onMessageComplete();
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
    }
  }
};
```

**SSE Event Types**:

1. **Text Event** - AI speaking to user
```json
{
  "type": "text",
  "content": "I'll help you find Product Manager roles!"
}
```

2. **Action Event** - Tool execution result
```json
{
  "type": "action",
  "name": "search_jobs",
  "payload": {
    "items": [...],
    "paging": { "total": 50 }
  }
}
```

3. **Error Event**
```json
{
  "type": "error",
  "message": "Tool execution failed"
}
```

4. **Done Event**
```json
{
  "type": "done"
}
```

---

## 🎯 Goals Management

### 4. List Goals
```
GET /api/goals?status=ACTIVE&limit=10&offset=0
```

**Query Parameters**:
- `status` (optional): ACTIVE | PAUSED | COMPLETED | CANCELLED
- `type` (optional): JOB_SEARCH | RESUME_IMPROVEMENT | etc.
- `limit` (optional): Default 50
- `offset` (optional): Default 0

**Response**:
```json
{
  "goals": [
    {
      "id": "cmhg01pee0001mtxx54l8517s",
      "title": "Land Product Manager position",
      "description": "Find and apply to Product Manager roles",
      "type": "JOB_SEARCH",
      "status": "ACTIVE",
      "targetDate": "2025-12-31T00:00:00.000Z",
      "completedAt": null,
      "createdAt": "2025-11-01T08:07:28.307Z",
      "updatedAt": "2025-11-01T08:07:28.307Z",
      "metadata": null,
      "conversation": {
        "id": "test-autonomous-workflow",
        "title": null
      }
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

### 5. Get Goal Stats
```
GET /api/goals/stats
```

**Response**:
```json
{
  "byStatus": {
    "active": 3,
    "completed": 1,
    "paused": 0
  },
  "byType": {
    "job_search": 2,
    "resume_improvement": 1
  },
  "upcoming": [
    {
      "id": "...",
      "title": "Apply to 5 jobs per week",
      "type": "JOB_SEARCH",
      "targetDate": "2025-11-15T00:00:00.000Z"
    }
  ],
  "total": 4
}
```

### 6. Get Single Goal
```
GET /api/goals/:id
```

**Response**:
```json
{
  "goal": {
    "id": "cmhg01pee0001mtxx54l8517s",
    "title": "Land Product Manager position",
    ...
  }
}
```

### 7. Create Goal (Manual - AI does this automatically)
```
POST /api/goals
```

**Body**:
```json
{
  "title": "Apply to 5 jobs per week",
  "description": "Actively apply to 5 suitable positions each week",
  "type": "JOB_SEARCH",
  "targetDate": "2025-12-31",
  "conversationId": "optional-conversation-id",
  "metadata": {}
}
```

### 8. Update Goal
```
PUT /api/goals/:id
```

**Body**:
```json
{
  "status": "COMPLETED",
  "title": "Updated title",
  "description": "Updated description"
}
```

### 9. Delete Goal
```
DELETE /api/goals/:id
```

---

## 📅 Routines/Schedules

**Note**: AI creates these automatically, but frontend can display and manage them

### Endpoints Available:
- The AI creates routines via tools, but there are NO direct API endpoints yet
- Routines are managed through the chat interface by talking to the AI
- To display routines, ask the AI: "show me my routines"

**Recommended**: Ask AI to list routines in chat, or create dedicated endpoints if needed.

---

## 👤 Profile Management

### 10. Get Profile
```
GET /api/profile
```

**Response**:
```json
{
  "profile": {
    "id": 1,
    "userId": 1,
    "data": {
      "name": "John Doe",
      "email": "john@example.com",
      "skills": ["JavaScript", "React"],
      "experience": [...],
      "education": [...]
    },
    "updatedAt": "2025-11-01T08:07:28.307Z"
  }
}
```

### 11. Update Profile
```
POST /api/profile
```

**Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "location": "San Francisco, CA",
  "skills": ["JavaScript", "React", "Node.js"],
  "experience": [...],
  "education": [...]
}
```

### 12. Update Profile Preferences
```
POST /api/profile/preferences
```

**Body**:
```json
{
  "preferredRoles": ["Product Manager", "Senior PM"],
  "preferredLocations": ["San Francisco", "Remote"],
  "salaryRange": {
    "min": 120000,
    "max": 180000
  },
  "jobType": "Full-time",
  "workMode": "Remote"
}
```

### 13. Get Profile Memories
```
GET /api/profile/memories?limit=10
```

**Response**:
```json
{
  "memories": [
    {
      "id": "...",
      "summary": "User is interested in Product Manager roles at tech startups",
      "importance": 8,
      "createdAt": "2025-11-01T08:07:28.307Z"
    }
  ]
}
```

---

## 📊 Application Tracking

### Applications are tracked automatically by AI
- AI submits applications via `submit_application` tool
- AI checks status via `track_applications` tool
- Frontend can display this data from chat responses

**To get application status, ask the AI**:
```
User: "What's the status of my applications?"
AI: [Uses track_applications tool and returns results]
```

---

## 🔧 Helper Endpoints

### 14. Health Check
```
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-01T09:10:40.131Z",
  "uptime": 17.625580791,
  "memory": {...},
  "services": {
    "server": "running"
  }
}
```

### 15. Get User Subscription
```
GET /api/subscription
```

**Response**:
```json
{
  "subscription": {
    "tier": "FREE",
    "status": "ACTIVE",
    "currentPeriodEnd": "2025-12-01T00:00:00.000Z"
  }
}
```

### 16. Get Usage Stats
```
GET /api/usage
```

**Response**:
```json
{
  "usage": {
    "messagesUsed": 45,
    "messagesLimit": 100,
    "resetAt": "2025-11-02T00:00:00.000Z"
  }
}
```

---

## 🎨 Frontend Chat UI Implementation Guide

### Recommended Chat Component Structure

```javascript
const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = async (text) => {
    // Add user message to UI
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsStreaming(true);

    // Start AI response
    let aiMessage = { role: 'assistant', content: '', toolResults: [] };
    setMessages(prev => [...prev, aiMessage]);

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: text,
        conversationId
      })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6).trim();
          if (data && data !== '[DONE]') {
            const json = JSON.parse(data);

            if (json.type === 'text') {
              // Append text to AI message
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1].content += json.content;
                return updated;
              });
            }

            if (json.type === 'action') {
              // Display tool result
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1].toolResults.push(json);
                return updated;
              });
            }

            if (json.type === 'done') {
              setIsStreaming(false);
            }
          }
        }
      }
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, idx) => (
          <Message key={idx} message={msg} />
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && sendMessage(input)}
        disabled={isStreaming}
      />
    </div>
  );
};
```

---

## 🚀 Quick Start Checklist for Frontend

1. **Authentication Flow**:
   - [ ] Register/Login page
   - [ ] Store JWT token in localStorage
   - [ ] Add token to all API requests

2. **Chat Interface** (PRIMARY FEATURE):
   - [ ] SSE-based chat component
   - [ ] Display text messages
   - [ ] Display tool results (jobs, goals, applications)
   - [ ] Handle streaming gracefully
   - [ ] Show loading states

3. **Goals Dashboard** (SECONDARY):
   - [ ] Fetch and display goals (`GET /api/goals`)
   - [ ] Show goal stats (`GET /api/goals/stats`)
   - [ ] Update goal status if needed

4. **Profile Setup**:
   - [ ] Profile form (`POST /api/profile`)
   - [ ] Preferences form (`POST /api/profile/preferences`)

5. **Usage Display**:
   - [ ] Show messages used / limit
   - [ ] Display subscription tier

---

## 💡 Key Points for Frontend Developers

1. **Main Endpoint**: `/api/chat` - This is where ALL user interactions happen
2. **SSE Streaming**: Chat uses Server-Sent Events, not traditional JSON responses
3. **AI Does Everything**: The AI creates goals, routines, and applications automatically
4. **Display Tool Results**: When AI uses tools, display the results nicely (job cards, goal updates, etc.)
5. **Conversational UI**: Make it feel like chatting with a helpful assistant
6. **Show Progress**: Display when AI is searching jobs, applying, creating goals, etc.

---

## 📝 Example User Flow

1. **User signs up** → `POST /api/register`
2. **User sets up profile** → `POST /api/profile`
3. **User says**: "I want to find a software engineer job" → `POST /api/chat`
4. **AI responds**:
   - Creates goal (shown in chat)
   - Sets up daily search routine (shown in chat)
   - Searches for jobs immediately (job cards shown)
5. **User asks**: "Any updates?" → `POST /api/chat`
6. **AI responds**:
   - Checks application status
   - Searches for new jobs
   - Updates goals
   - Reports back with all info

**The frontend just sends messages and displays streaming responses. The AI handles all the logic!**
