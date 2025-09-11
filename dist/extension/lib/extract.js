(function() {
  'use strict';
  
  // Wait for DataLoader module to be available
  const getSkills = async () => window.ResumeModules?.DataLoader?.getSkills() || [];
  const getSynonyms = async () => window.ResumeModules?.DataLoader?.getSynonyms() || {};
  
  async function extractSignals(jdText) {
  const normalized = jdText.toLowerCase();
  const original = jdText;
  
  const signals = {
    roleGuess: extractRole(original),
    seniority: extractSeniority(normalized),
    domainHints: extractDomain(normalized),
    topKeywords: await extractKeywords(normalized),
    mustHave: extractRequirements(original, 'must'),
    niceToHave: extractRequirements(original, 'nice'),
    companyName: extractCompany(original),
    locationHints: extractLocation(original),
    jdText: jdText
  };
  
  return signals;
}

function extractRole(text) {
  const rolePatterns = [
    /(?:job\s+title|position|role)[\s:]+([^\n]+)/i,
    /^([^-\n]+(?:engineer|developer|architect|designer|manager|analyst|scientist))/mi,
    /hiring\s+(?:a|an)\s+([^\n]+)/i
  ];
  
  for (const pattern of rolePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim().replace(/[^\w\s]/g, '').slice(0, 50);
    }
  }
  
  return null;
}

function extractSeniority(text) {
  const seniorityMap = {
    'junior': ['junior', 'entry level', 'entry-level', 'graduate', 'intern'],
    'mid': ['mid-level', 'mid level', 'intermediate', '2-5 years', '3-5 years'],
    'senior': ['senior', 'sr.', 'lead', '5+ years', '7+ years', 'experienced'],
    'staff': ['staff', 'principal', 'architect', '10+ years', 'expert'],
    'manager': ['manager', 'head', 'director', 'vp', 'vice president']
  };
  
  for (const [level, keywords] of Object.entries(seniorityMap)) {
    if (keywords.some(kw => text.includes(kw))) {
      return level;
    }
  }
  
  return 'mid';
}

function extractDomain(text) {
  const domains = {
    'FinTech': ['fintech', 'financial', 'banking', 'payment', 'trading', 'investment'],
    'Healthcare': ['healthcare', 'medical', 'health', 'clinical', 'patient', 'hospital'],
    'E-commerce': ['ecommerce', 'e-commerce', 'retail', 'marketplace', 'shopping'],
    'SaaS': ['saas', 'software as a service', 'subscription', 'cloud platform'],
    'Security': ['security', 'cybersecurity', 'infosec', 'encryption', 'compliance'],
    'Data': ['data science', 'machine learning', 'analytics', 'big data', 'ai/ml'],
    'DevOps': ['devops', 'ci/cd', 'infrastructure', 'deployment', 'kubernetes']
  };
  
  const found = [];
  for (const [domain, keywords] of Object.entries(domains)) {
    if (keywords.some(kw => text.includes(kw))) {
      found.push(domain);
    }
  }
  
  return found;
}

async function extractKeywords(text) {
  const tokens = tokenize(text);
  const bigrams = getBigrams(tokens);
  const allTokens = [...tokens, ...bigrams];
  
  const frequency = {};
  allTokens.forEach(token => {
    if (isRelevantKeyword(token)) {
      frequency[token] = (frequency[token] || 0) + 1;
    }
  });
  
  const skills = await getSkills();
  const canonicalSkills = new Set(skills.technical.concat(skills.soft));
  const prioritized = [];
  const remaining = [];
  
  for (const [keyword, count] of Object.entries(frequency)) {
    const canonical = await normalizeSkill(keyword);
    if (canonicalSkills.has(canonical)) {
      prioritized.push({ keyword: canonical, count });
    } else if (count > 1) {
      remaining.push({ keyword, count });
    }
  }
  
  prioritized.sort((a, b) => b.count - a.count);
  remaining.sort((a, b) => b.count - a.count);
  
  return [...prioritized, ...remaining].map(item => item.keyword);
}

function tokenize(text) {
  return text
    .replace(/[^\w\s+#]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2);
}

function getBigrams(tokens) {
  const bigrams = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
}

function isRelevantKeyword(token) {
  const stopwords = new Set([
    'the', 'and', 'for', 'with', 'you', 'will', 'our', 'your', 'this',
    'that', 'from', 'have', 'are', 'can', 'but', 'not', 'all', 'would',
    'there', 'their', 'what', 'about', 'which', 'when', 'one', 'two'
  ]);
  
  return !stopwords.has(token.toLowerCase()) && 
         (token.length > 3 || /^[A-Z]+$/.test(token));
}

async function normalizeSkill(skill) {
  const lower = skill.toLowerCase();
  const synonyms = await getSynonyms();
  
  for (const [canonical, alts] of Object.entries(synonyms)) {
    if (alts.includes(lower) || lower === canonical.toLowerCase()) {
      return canonical;
    }
  }
  
  return skill;
}

function extractRequirements(text, type) {
  const mustPatterns = [
    /requirements?:?\s*\n([\s\S]*?)(?:\n\n|\npreferred|\nnice|$)/i,
    /must have:?\s*\n([\s\S]*?)(?:\n\n|\npreferred|\nnice|$)/i,
    /minimum qualifications?:?\s*\n([\s\S]*?)(?:\n\n|\npreferred|$)/i
  ];
  
  const nicePatterns = [
    /preferred:?\s*\n([\s\S]*?)(?:\n\n|$)/i,
    /nice to have:?\s*\n([\s\S]*?)(?:\n\n|$)/i,
    /bonus:?\s*\n([\s\S]*?)(?:\n\n|$)/i
  ];
  
  const patterns = type === 'must' ? mustPatterns : nicePatterns;
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1]
        .split(/\n/)
        .map(line => line.replace(/^[•\-*]\s*/, '').trim())
        .filter(line => line.length > 0);
    }
  }
  
  return [];
}

function extractCompany(text) {
  const patterns = [
    /(?:about|join)\s+([A-Z][A-Za-z0-9\s&]+?)(?:\.|,|\n|$)/,
    /([A-Z][A-Za-z0-9\s&]+?)\s+is\s+(?:hiring|looking|seeking)/,
    /work\s+at\s+([A-Z][A-Za-z0-9\s&]+?)(?:\.|,|\n|$)/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

function extractLocation(text) {
  const patterns = [
    /location:?\s*([^\n]+)/i,
    /(?:based in|located in)\s+([^\n,]+)/i,
    /(?:remote|hybrid|on-site|onsite)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1] ? match[1].trim() : match[0];
    }
  }
  
  return null;
}

  async function mapToResume(profile, signals) {
  const truthSet = await buildTruthSet(profile);
  const allowedInsertions = [];
  
  for (const kw of signals.topKeywords) {
    const normalized = await normalizeSkill(kw.toLowerCase());
    if (truthSet.has(normalized)) {
      allowedInsertions.push(kw);
    }
  }
  
  const draft = {
    summary: generateSummary(profile, signals, allowedInsertions),
    skills: await prioritizeSkills(profile.skills, allowedInsertions),
    experienceBullets: await tailorExperience(profile.experience, signals, allowedInsertions),
    projectsBullets: await tailorProjects(profile.projects, signals, allowedInsertions),
    notes: await generateWarnings(signals, truthSet),
    template: profile.template || 'standard'
  };
  
  return draft;
}

async function buildTruthSet(profile) {
  const truth = new Set();
  
  for (const skill of (profile.skills || [])) {
    const normalized = await normalizeSkill(skill.toLowerCase());
    truth.add(normalized);
  }
  
  const allBullets = [];
  (profile.experience || []).forEach(exp => {
    allBullets.push(...exp.bullets);
  });
  (profile.projects || []).forEach(proj => {
    allBullets.push(...proj.bullets);
  });
  
  const bulletText = allBullets.join(' ').toLowerCase();
  const bulletTokens = tokenize(bulletText);
  for (const token of bulletTokens) {
    if (isRelevantKeyword(token)) {
      const normalized = await normalizeSkill(token);
      truth.add(normalized);
    }
  }
  
  return truth;
}

function generateSummary(profile, signals, allowedInsertions) {
  const role = signals.roleGuess || profile.headline || 'Professional';
  const topSkills = allowedInsertions.slice(0, 4).join(', ');
  const domain = signals.domainHints[0] || '';
  
  let summary = role;
  if (topSkills) {
    summary += ` with expertise in ${topSkills}`;
  }
  if (domain) {
    summary += ` for ${domain} applications`;
  }
  
  if (summary.length > 200) {
    summary = summary.slice(0, 197) + '...';
  }
  
  return summary;
}

async function prioritizeSkills(userSkills, allowedInsertions) {
  const prioritized = [];
  const remaining = [];
  
  for (const skill of userSkills) {
    const normalized = await normalizeSkill(skill.toLowerCase());
    let isPriority = false;
    
    for (const ai of allowedInsertions) {
      const aiNormalized = await normalizeSkill(ai.toLowerCase());
      if (aiNormalized === normalized) {
        isPriority = true;
        break;
      }
    }
    
    if (isPriority) {
      prioritized.push(skill);
    } else {
      remaining.push(skill);
    }
  }
  
  const combined = [...prioritized, ...remaining];
  return combined.slice(0, 24);
}

async function tailorExperience(experience, signals, allowedInsertions) {
  const tailored = [];
  
  for (let idx = 0; idx < experience.length; idx++) {
    const exp = experience[idx];
    const newBullets = [];
    
    for (const bullet of exp.bullets) {
      const enhanced = await enhanceBullet(bullet, signals, allowedInsertions);
      newBullets.push(enhanced);
    }
    
    tailored.push({
      jobIndex: idx,
      newBullets: newBullets.slice(0, 5)
    });
  }
  
  return tailored;
}

async function tailorProjects(projects, signals, allowedInsertions) {
  const tailored = [];
  
  for (let idx = 0; idx < projects.length; idx++) {
    const proj = projects[idx];
    const newBullets = [];
    
    for (const bullet of proj.bullets) {
      const enhanced = await enhanceBullet(bullet, signals, allowedInsertions);
      newBullets.push(enhanced);
    }
    
    tailored.push({
      projectIndex: idx,
      newBullets
    });
  }
  
  return tailored;
}

async function enhanceBullet(bullet, signals, allowedInsertions) {
  let enhanced = bullet;
  
  const verbMap = {
    'implemented': ['built', 'developed', 'created'],
    'built': ['implemented', 'developed', 'engineered'],
    'managed': ['led', 'oversaw', 'coordinated'],
    'improved': ['optimized', 'enhanced', 'upgraded']
  };
  
  for (const [original, alternatives] of Object.entries(verbMap)) {
    if (bullet.toLowerCase().includes(original)) {
      for (const alt of alternatives) {
        if (signals.jdText.toLowerCase().includes(alt)) {
          enhanced = enhanced.replace(new RegExp(original, 'i'), alt);
          break;
        }
      }
    }
  }
  
  let insertCount = 0;
  for (const keyword of allowedInsertions) {
    if (insertCount >= 2) break;
    
    const normalized = await normalizeSkill(keyword.toLowerCase());
    if (!enhanced.toLowerCase().includes(normalized) && 
        bullet.toLowerCase().includes(normalized.split(' ')[0])) {
      enhanced = enhanced.replace(/\.$/, '') + ` using ${keyword}.`;
      insertCount++;
    }
  }
  
  const words = enhanced.split(' ');
  if (words.length > 22) {
    enhanced = words.slice(0, 22).join(' ') + '...';
  }
  
  return enhanced;
}

async function generateWarnings(signals, truthSet) {
  const warnings = [];
  
  for (const req of signals.mustHave) {
    const reqTokens = tokenize(req.toLowerCase());
    let hasMatch = false;
    
    for (const token of reqTokens) {
      const normalized = await normalizeSkill(token);
      if (truthSet.has(normalized)) {
        hasMatch = true;
        break;
      }
    }
    
    if (!hasMatch && req.length > 10) {
      warnings.push(`Required: "${req.slice(0, 50)}..." not found in profile`);
    }
  }
  
  if (warnings.length > 5) {
    return warnings.slice(0, 5);
  }
  
  return warnings;
  }
  
  // Export to global namespace
  window.ResumeModules = window.ResumeModules || {};
  window.ResumeModules.Extract = {
    extractSignals,
    mapToResume
  };
})();