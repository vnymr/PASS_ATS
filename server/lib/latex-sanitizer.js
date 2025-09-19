const LATEX_SPECIAL_CHARS = {
  '\\': '\\textbackslash ',
  '%': '\\%',
  '&': '\\&',
  '#': '\\#',
  '_': '\\_',
  '$': '\\$',
  '{': '\\{',
  '}': '\\}',
  '^': '\\textasciicircum{}',
  '~': '\\textasciitilde{}',
  '<': '\\textless{}',
  '>': '\\textgreater{}',
  '|': '\\textbar{}',
  '"': "''",
  '`': "'",
};

const COMMAND_PATTERN = /\\[a-zA-Z]+/g;

export function escapeLatex(text) {
  if (!text) return '';

  if (typeof text !== 'string') {
    text = String(text);
  }

  text = text.trim();

  // Escape special characters in order, handling backslash first
  text = text.replace(/\\/g, '\\textbackslash ');
  text = text.replace(/%/g, '\\%');
  text = text.replace(/&/g, '\\&');
  text = text.replace(/#/g, '\\#');
  text = text.replace(/_/g, '\\_');
  text = text.replace(/\$/g, '\\$');
  text = text.replace(/\{/g, '\\{');
  text = text.replace(/\}/g, '\\}');
  text = text.replace(/\^/g, '\\textasciicircum{}');
  text = text.replace(/~/g, '\\textasciitilde{}');

  // Handle paragraphs and newlines
  text = text.replace(/\n\n+/g, '\\par ');
  text = text.replace(/\n/g, ' ');

  // Clean up multiple spaces
  text = text.replace(/\s+/g, ' ');

  // Handle special typography
  text = text.replace(/--/g, '{-}{-}');
  text = text.replace(/\.\.\./g, '\\ldots{}');

  // Smart quotes
  text = text.replace(/'/g, "'");
  text = text.replace(/'/g, "'");
  text = text.replace(/"/g, "``");
  text = text.replace(/"/g, "''");

  text = sanitizeCommands(text);

  return text;
}

function sanitizeCommands(text) {
  const allowedCommands = new Set([
    '\\textbf', '\\textit', '\\emph', '\\underline',
    '\\small', '\\large', '\\Large', '\\footnotesize',
    '\\ldots', '\\textbackslash', '\\par',
    '\\textless', '\\textgreater', '\\textbar',
  ]);

  return text.replace(COMMAND_PATTERN, (match) => {
    if (allowedCommands.has(match)) {
      return match;
    }
    return escapeCommand(match);
  });
}

function escapeCommand(command) {
  return command.split('').map(char => {
    if (char === '\\') {
      return '\\textbackslash ';
    }
    return char;
  }).join('');
}

export function validateLatexSafety(latex) {
  const dangerousPatterns = [
    /\\input\{(?!glyphtounicode)/,  // Allow glyphtounicode input
    /\\include\{/,
    /\\usepackage\{.*shell.*\}/,
    /\\write18/,
    /\\immediate\\write/,
    /\\catcode/,
    /\\def\\/,
    /\\newcommand(?!\{\\resume)/,  // Allow resume-specific commands
    /\\renewcommand(?!\{\\head|\{\\foot|\{\\familydefault)/,   // Allow header, footer, and font commands
    /\\expandafter/,
    /\\csname/,
    /\\endcsname/,
    /\\special/,
    /\\pdfliteral/,
  ];

  const issues = [];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(latex)) {
      issues.push(`Dangerous pattern detected: ${pattern.source}`);
    }
  }

  const nestingLevel = checkBraceNesting(latex);
  if (nestingLevel !== 0) {
    issues.push(`Unbalanced braces: nesting level ${nestingLevel}`);
  }

  const maxLength = 100000;
  if (latex.length > maxLength) {
    issues.push(`LaTeX source too long: ${latex.length} characters (max: ${maxLength})`);
  }

  // Check for required resume structure elements
  const requiredElements = [
    /\\documentclass/,
    /\\begin\{document\}/,
    /\\end\{document\}/,
  ];

  for (const pattern of requiredElements) {
    if (!pattern.test(latex)) {
      issues.push(`Missing required element: ${pattern.source}`);
    }
  }

  return {
    safe: issues.length === 0,
    issues,
  };
}

function checkBraceNesting(text) {
  let level = 0;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '{') {
      level++;
    } else if (char === '}') {
      level--;
    }
  }

  return level;
}

export function sanitizeBulletPoint(text) {
  text = escapeLatex(text);

  text = text.replace(/^\s*[-•·▪▫◦‣⁃]\s*/, '');

  text = text.replace(/^(Led|Managed|Developed|Implemented|Created|Built|Designed|Achieved|Improved|Reduced|Increased|Delivered)/i,
    (match) => `\\textbf{${match}}`);

  text = text.replace(/(\d+%|\$[\d,]+[KMB]?|\d+x)/g,
    (match) => `\\textbf{${match}}`);

  if (!text.match(/[.!?]$/)) {
    text += '.';
  }

  return text;
}

export function sanitizeUrl(url) {
  if (!url) return '';

  url = url.replace(/[{}%#]/g, (char) => '\\' + char);

  if (!/^https?:\/\//.test(url)) {
    url = 'https://' + url;
  }

  return url;
}

export function wrapLongText(text, maxLength = 80) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).length > maxLength) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        lines.push(word);
      }
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.join('\n');
}