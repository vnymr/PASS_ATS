// Module loader for Chrome extension compatibility
// This file loads all modules in the correct order without ES6 imports

(function() {
  'use strict';
  
  // Create global namespace for modules
  window.ResumeModules = window.ResumeModules || {};
  
  // Helper to load scripts sequentially
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  // Load modules in dependency order
  window.loadResumeModules = async function() {
    try {
      // Load base modules first
      await loadScript('./lib/data-loader-compat.js');
      await loadScript('./lib/extract-compat.js');
      await loadScript('./lib/ai-analyzer-compat.js');
      await loadScript('./lib/latex-compat.js');
      
      console.log('All modules loaded successfully');
      return true;
    } catch (error) {
      console.error('Module loading failed:', error);
      return false;
    }
  };
})();