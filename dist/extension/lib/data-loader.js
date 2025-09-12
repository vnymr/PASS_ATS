// Data loader for skills and synonyms
(function() {
  'use strict';
  
  let skillsData = null;
  let synonymsData = null;
  
  async function loadData() {
  if (!skillsData) {
    try {
      const skillsResponse = await fetch(chrome.runtime.getURL('lib/skills.json'));
      skillsData = await skillsResponse.json();
    } catch (error) {
      console.error('Failed to load skills:', error);
      // Fallback data
      skillsData = {
        technical: ["JavaScript", "Python", "React", "Node.js", "AWS", "Docker"],
        soft: ["Leadership", "Communication", "Problem Solving"],
        verbs: ["Developed", "Implemented", "Designed", "Built"]
      };
    }
  }
  
  if (!synonymsData) {
    try {
      const synonymsResponse = await fetch(chrome.runtime.getURL('lib/synonyms.json'));
      synonymsData = await synonymsResponse.json();
    } catch (error) {
      console.error('Failed to load synonyms:', error);
      // Fallback data
      synonymsData = {
        "Kubernetes": ["k8s"],
        "JavaScript": ["js"],
        "TypeScript": ["ts"]
      };
    }
  }
  
  return { skills: skillsData, synonyms: synonymsData };
}

  async function getSkills() {
    const data = await loadData();
    return data.skills;
  }
  
  async function getSynonyms() {
    const data = await loadData();
    return data.synonyms;
  }
  
  // Export to global namespace
  window.ResumeModules = window.ResumeModules || {};
  window.ResumeModules.DataLoader = {
    loadData,
    getSkills,
    getSynonyms
  };
})();