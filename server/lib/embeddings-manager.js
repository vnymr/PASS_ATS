import OpenAI from 'openai';
import { prisma } from './prisma-client.js';
import { config } from './config.js';
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function createEmbeddings(jobId, resumeText, jobDescription) {
  const skills = extractSkills(resumeText);
  const experiences = extractExperiences(resumeText);
  const requirements = extractRequirements(jobDescription);
  const keywords = extractKeywords(jobDescription);

  const allContent = [
    ...skills.map(s => ({ content: s, type: 'SKILL' })),
    ...experiences.map(e => ({ content: e, type: 'EXPERIENCE' })),
    ...requirements.map(r => ({ content: r, type: 'REQUIREMENT' })),
    ...keywords.map(k => ({ content: k, type: 'KEYWORD' })),
  ];

  const embeddings = [];

  // Process embeddings in batches using OpenAI's batch API
  for (const batch of chunkArray(allContent, config.embeddings.batchSize)) {
    try {
      // Create embeddings for the entire batch in one API call
      const inputs = batch.map(item => item.content);
      const response = await openai.embeddings.create({
        model: config.openai.embeddingModel,
        input: inputs,
      });

      // Map the embeddings back to the items
      response.data.forEach((embeddingData, index) => {
        embeddings.push({
          jobId,
          content: batch[index].content.substring(0, 1000),
          contentType: batch[index].type,
          embedding: embeddingData.embedding,
        });
      });
    } catch (error) {
      console.error('Failed to create embeddings for batch:', error);
      // Fall back to individual processing if batch fails
      for (const item of batch) {
        try {
          const response = await openai.embeddings.create({
            model: config.openai.embeddingModel,
            input: item.content,
          });
          embeddings.push({
            jobId,
            content: item.content.substring(0, 1000),
            contentType: item.type,
            embedding: response.data[0].embedding,
          });
        } catch (itemError) {
          console.error(`Failed to create embedding for: ${item.content.substring(0, 50)}`, itemError);
        }
      }
    }
  }

  await prisma.embedding.createMany({
    data: embeddings,
  });

  return embeddings;
}

export async function findRelevantContent(jobId, targetEmbeddings) {
  const requirementEmbeddings = targetEmbeddings.filter(e => e.contentType === 'REQUIREMENT');
  const keywordEmbeddings = targetEmbeddings.filter(e => e.contentType === 'KEYWORD');

  const skillEmbeddings = await prisma.embedding.findMany({
    where: {
      jobId,
      contentType: 'SKILL',
    },
  });

  const experienceEmbeddings = await prisma.embedding.findMany({
    where: {
      jobId,
      contentType: 'EXPERIENCE',
    },
  });

  const relevantSkills = [];
  const relevantExperiences = [];

  // Helper function to safely get max value
  const safeMax = (arr) => arr.length > 0 ? Math.max(...arr) : 0;

  for (const skill of skillEmbeddings) {
    const reqSimilarities = requirementEmbeddings.map(req => cosineSimilarity(skill.embedding, req.embedding));
    const kwSimilarities = keywordEmbeddings.map(kw => cosineSimilarity(skill.embedding, kw.embedding));

    const maxSimilarity = Math.max(
      safeMax(reqSimilarities),
      safeMax(kwSimilarities)
    );

    // Ensure relevance is between 0 and 1
    const clampedRelevance = Math.min(Math.max(maxSimilarity, 0), 1);

    if (clampedRelevance > config.embeddings.relevanceThreshold.skills) {
      relevantSkills.push({
        content: skill.content,
        relevance: clampedRelevance,
      });
    }

    await prisma.embedding.update({
      where: { id: skill.id },
      data: { relevance: clampedRelevance },
    });
  }

  for (const exp of experienceEmbeddings) {
    const reqSimilarities = requirementEmbeddings.map(req => cosineSimilarity(exp.embedding, req.embedding));
    const maxSimilarity = safeMax(reqSimilarities);

    // Ensure relevance is between 0 and 1
    const clampedRelevance = Math.min(Math.max(maxSimilarity, 0), 1);

    if (clampedRelevance > config.embeddings.relevanceThreshold.experiences) {
      relevantExperiences.push({
        content: exp.content,
        relevance: clampedRelevance,
      });
    }

    await prisma.embedding.update({
      where: { id: exp.id },
      data: { relevance: clampedRelevance },
    });
  }

  relevantSkills.sort((a, b) => b.relevance - a.relevance);
  relevantExperiences.sort((a, b) => b.relevance - a.relevance);

  return {
    skills: relevantSkills.slice(0, 15),
    experiences: relevantExperiences.slice(0, 10),
    topKeywords: keywordEmbeddings.slice(0, 10).map(k => k.content),
  };
}

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function extractSkills(resumeText) {
  const skillPatterns = [
    /Skills?:?\s*([^\n]+)/gi,
    /Technical Skills?:?\s*([^\n]+)/gi,
    /Core Competencies:?\s*([^\n]+)/gi,
    /Technologies?:?\s*([^\n]+)/gi,
    /Programming Languages?:?\s*([^\n]+)/gi,
  ];

  const skills = new Set();

  for (const pattern of skillPatterns) {
    const matches = resumeText.matchAll(pattern);
    for (const match of matches) {
      const skillLine = match[1];
      const individualSkills = skillLine.split(/[,;|•·]/);
      individualSkills.forEach(skill => {
        const cleaned = skill.trim().replace(/[()]/g, '');
        if (cleaned && cleaned.length > 1 && cleaned.length < 50) {
          skills.add(cleaned);
        }
      });
    }
  }

  const techKeywords = [
    'JavaScript', 'Python', 'Java', 'C++', 'React', 'Node.js', 'AWS',
    'Docker', 'Kubernetes', 'SQL', 'MongoDB', 'PostgreSQL', 'Git',
    'TypeScript', 'Vue.js', 'Angular', 'Spring', 'Django', 'Flask',
    'Redis', 'GraphQL', 'REST API', 'CI/CD', 'Agile', 'Scrum',
  ];

  for (const keyword of techKeywords) {
    // Escape special regex characters including + for C++
    const escapedKeyword = keyword.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'gi');
    if (regex.test(resumeText)) {
      skills.add(keyword);
    }
  }

  return Array.from(skills);
}

function extractExperiences(resumeText) {
  const experiences = [];
  const bulletPattern = /[•·▪▫◦‣⁃-]\s*(.+?)(?=\n[•·▪▫◦‣⁃-]|\n\n|\n[A-Z]|$)/g;
  const matches = resumeText.matchAll(bulletPattern);

  for (const match of matches) {
    const bullet = match[1].trim();
    if (bullet.length > 30 && bullet.length < 300) {
      if (/\b(led|managed|developed|implemented|created|built|designed|achieved|improved|reduced|increased|delivered)\b/i.test(bullet)) {
        experiences.push(bullet);
      }
    }
  }

  return experiences;
}

function extractRequirements(jobDescription) {
  const requirements = [];
  const reqPatterns = [
    /Requirements?:?\s*([^:]+?)(?=\n\n|\nResponsibilities|\nQualifications|$)/gis,
    /Qualifications?:?\s*([^:]+?)(?=\n\n|\nResponsibilities|\nRequirements|$)/gis,
    /Must have:?\s*([^:]+?)(?=\n\n|\nNice to have|$)/gis,
  ];

  for (const pattern of reqPatterns) {
    const matches = jobDescription.matchAll(pattern);
    for (const match of matches) {
      const section = match[1];
      const bullets = section.split(/\n[•·▪▫◦‣⁃-]/);
      bullets.forEach(bullet => {
        const cleaned = bullet.trim();
        if (cleaned && cleaned.length > 10 && cleaned.length < 200) {
          requirements.push(cleaned);
        }
      });
    }
  }

  const bulletPattern = /[•·▪▫◦‣⁃-]\s*(.+?)(?=\n[•·▪▫◦‣⁃-]|\n\n|$)/g;
  const matches = jobDescription.matchAll(bulletPattern);
  for (const match of matches) {
    const bullet = match[1].trim();
    if (bullet.length > 10 && bullet.length < 200) {
      requirements.push(bullet);
    }
  }

  return requirements.slice(0, 20);
}

function extractKeywords(jobDescription) {
  const keywords = new Set();

  const importantPatterns = [
    /\b(?:experience with|knowledge of|proficient in|expertise in|familiar with)\s+([A-Za-z0-9+#. ]+)/gi,
    /\b([A-Z][a-z]+(?: [A-Z][a-z]+)*)\b/g,
    /\b(?:\d+\+? years?)\s+(?:of\s+)?([A-Za-z0-9+#. ]+)/gi,
  ];

  for (const pattern of importantPatterns) {
    const matches = jobDescription.matchAll(pattern);
    for (const match of matches) {
      const keyword = match[1].trim();
      if (keyword && keyword.length > 2 && keyword.length < 30) {
        keywords.add(keyword);
      }
    }
  }

  const techTerms = jobDescription.match(/\b[A-Z]{2,}(?:\.[A-Z]{2,})*\b/g) || [];
  techTerms.forEach(term => {
    if (term.length <= 10) {
      keywords.add(term);
    }
  });

  return Array.from(keywords).slice(0, 30);
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}