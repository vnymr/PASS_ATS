import { useEffect, useRef, useState } from 'react';

interface LatexPreviewProps {
  latex: string;
  className?: string;
}

export default function LatexPreview({ latex, className = '' }: LatexPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!latex || !containerRef.current) return;

    setLoading(true);

    // Render the LaTeX as styled HTML
    const html = renderLatexToHtml(latex);
    containerRef.current.innerHTML = html;

    setLoading(false);
  }, [latex]);

  return (
    <div className={`latex-preview relative ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
        </div>
      )}
      <div
        ref={containerRef}
        className="latex-content w-full h-full overflow-auto bg-white"
        style={{
          fontFamily: '"Times New Roman", "Computer Modern Serif", Georgia, serif',
          fontSize: '10pt',
          lineHeight: '1.3',
          padding: '40px 50px',
          color: '#000',
        }}
      />
    </div>
  );
}

// Parse LaTeX and render as styled HTML that looks like a real resume
function renderLatexToHtml(latex: string): string {
  let html = '<div class="resume-document" style="max-width: 100%;">';

  // Extract content between \begin{document} and \end{document}
  const docMatch = latex.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  const content = docMatch ? docMatch[1] : latex;

  // Detect template type based on content patterns
  const isJakesStyle = latex.includes('\\resumeSubheading') || latex.includes('\\resumeItem');
  const isMinimalCentered = latex.includes('\\begin{center}') && latex.includes('\\Huge');
  const hasTabular = latex.includes('\\begin{tabular}');

  // Parse header section
  html += parseHeader(content, isMinimalCentered, hasTabular);

  // Parse sections
  const sectionRegex = /\\section\*?\{([^}]+)\}([\s\S]*?)(?=\\section\*?\{|$)/g;
  let match;

  while ((match = sectionRegex.exec(content)) !== null) {
    const sectionName = match[1].trim();
    const sectionContent = match[2];

    html += `
      <div style="margin-top: 14px;">
        <div style="font-size: 11pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 8px;">
          ${sectionName}
        </div>
    `;

    if (isJakesStyle) {
      html += parseJakesStyleSection(sectionContent);
    } else {
      html += parseGenericSection(sectionContent);
    }

    html += '</div>';
  }

  html += '</div>';
  return html;
}

function parseHeader(content: string, isMinimalCentered: boolean, hasTabular: boolean): string {
  let html = '';

  // Try to find centered header block
  const centerMatch = content.match(/\\begin\{center\}([\s\S]*?)\\end\{center\}/);

  if (centerMatch) {
    const headerContent = centerMatch[1];

    // Extract name - try multiple patterns
    let name = '';
    const namePatterns = [
      /\\textbf\{\\Huge\s*\\scshape\s*([^}]+)\}/,
      /\\textbf\{\\Huge\s*([^}]+)\}/,
      /\\Huge\{?\\textbf\{([^}]+)\}/,
      /\\textbf\{\\Large\s*([^}]+)\}/,
      /\{\\Large\s*\\textbf\{([^}]+)\}\}/,
    ];

    for (const pattern of namePatterns) {
      const nameMatch = headerContent.match(pattern);
      if (nameMatch) {
        name = cleanLatex(nameMatch[1]);
        break;
      }
    }

    // Extract contact info
    let contactInfo = '';
    const smallMatch = headerContent.match(/\\small\s*([\s\S]*?)(?=\\end|\\vspace|$)/i);
    if (smallMatch) {
      contactInfo = smallMatch[1]
        .replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, '$2')
        .replace(/\\underline\{([^}]*)\}/g, '$1')
        .replace(/\$\\vert\$/g, ' | ')
        .replace(/\$\|\$/g, ' | ')
        .replace(/\\,/g, ' ')
        .replace(/\\\\/g, ' ')
        .replace(/\\[a-zA-Z]+/g, ' ')
        .replace(/[{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    html += `
      <div style="text-align: center; margin-bottom: 12px;">
        <div style="font-size: 22pt; font-weight: bold; margin-bottom: 6px;">${name}</div>
        <div style="font-size: 9pt; color: #333;">${contactInfo}</div>
      </div>
    `;
  } else if (hasTabular) {
    // Handle tabular header (like Jake's resume)
    const tabularMatch = content.match(/\\begin\{tabular\}[^}]*\}([\s\S]*?)\\end\{tabular\}/);
    if (tabularMatch) {
      const tabContent = tabularMatch[1];

      // Extract name from tabular
      const nameMatch = tabContent.match(/\\textbf\{\\Huge\s*\\scshape\s*([^}]+)\}/) ||
                        tabContent.match(/\\textbf\{([^}]+)\}/);
      const name = nameMatch ? cleanLatex(nameMatch[1]) : '';

      // Extract contact links
      const links: string[] = [];
      const hrefRegex = /\\href\{[^}]*\}\{([^}]*)\}/g;
      let linkMatch;
      while ((linkMatch = hrefRegex.exec(tabContent)) !== null) {
        links.push(cleanLatex(linkMatch[1]));
      }

      html += `
        <div style="text-align: center; margin-bottom: 12px;">
          <div style="font-size: 22pt; font-weight: bold; margin-bottom: 6px;">${name}</div>
          <div style="font-size: 9pt; color: #333;">${links.join(' | ')}</div>
        </div>
      `;
    }
  }

  return html;
}

function parseJakesStyleSection(content: string): string {
  let html = '';

  // Parse resumeSubheading entries
  const subheadingRegex = /\\resumeSubheading\s*\{([^}]*)\}\s*\{([^}]*)\}\s*\{([^}]*)\}\s*\{([^}]*)\}/g;
  let subMatch;
  let lastIndex = 0;

  while ((subMatch = subheadingRegex.exec(content)) !== null) {
    const [fullMatch, title, dates, subtitle, location] = subMatch;

    // Get items between this subheading and the next (or end)
    const startIdx = subMatch.index + fullMatch.length;
    const nextSubheading = content.indexOf('\\resumeSubheading', startIdx);
    const itemsContent = nextSubheading > -1
      ? content.substring(startIdx, nextSubheading)
      : content.substring(startIdx);

    html += `
      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <span style="font-weight: bold; font-size: 10pt;">${cleanLatex(title)}</span>
          <span style="font-size: 9pt;">${cleanLatex(dates)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 1px;">
          <span style="font-style: italic; font-size: 9pt;">${cleanLatex(subtitle)}</span>
          <span style="font-style: italic; font-size: 9pt;">${cleanLatex(location)}</span>
        </div>
    `;

    // Parse resumeItem entries
    const items = parseResumeItems(itemsContent);
    if (items.length > 0) {
      html += '<ul style="margin: 4px 0 0 0; padding-left: 18px; list-style-type: disc;">';
      for (const item of items) {
        html += `<li style="font-size: 9pt; margin-bottom: 2px; padding-left: 2px;">${item}</li>`;
      }
      html += '</ul>';
    }

    html += '</div>';
    lastIndex = subheadingRegex.lastIndex;
  }

  // Handle resumeProjectHeading
  const projectRegex = /\\resumeProjectHeading\s*\{([^}]*)\}\s*\{([^}]*)\}/g;
  let projMatch;

  while ((projMatch = projectRegex.exec(content)) !== null) {
    const [fullMatch, titlePart, dates] = projMatch;

    // Get items after this project heading
    const startIdx = projMatch.index + fullMatch.length;
    const nextProject = content.indexOf('\\resumeProjectHeading', startIdx);
    const nextSubheading = content.indexOf('\\resumeSubheading', startIdx);
    let endIdx = content.length;
    if (nextProject > -1) endIdx = Math.min(endIdx, nextProject);
    if (nextSubheading > -1) endIdx = Math.min(endIdx, nextSubheading);
    const itemsContent = content.substring(startIdx, endIdx);

    html += `
      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <span style="font-size: 10pt;">${cleanLatex(titlePart)}</span>
          <span style="font-size: 9pt;">${cleanLatex(dates)}</span>
        </div>
    `;

    const items = parseResumeItems(itemsContent);
    if (items.length > 0) {
      html += '<ul style="margin: 4px 0 0 0; padding-left: 18px; list-style-type: disc;">';
      for (const item of items) {
        html += `<li style="font-size: 9pt; margin-bottom: 2px; padding-left: 2px;">${item}</li>`;
      }
      html += '</ul>';
    }

    html += '</div>';
  }

  // Handle skills/technical section (often just text)
  if (!subheadingRegex.test(content) && !projectRegex.test(content)) {
    // Check for itemize-style content
    const itemizeMatch = content.match(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/);
    if (itemizeMatch) {
      const itemContent = itemizeMatch[1];
      const itemRegex = /\\item\s*\{?\\textbf\{([^}]*)\}:?\}?\s*([^\\]*)/g;
      let itemMatch;

      html += '<div style="font-size: 9pt;">';
      while ((itemMatch = itemRegex.exec(itemContent)) !== null) {
        const [, label, value] = itemMatch;
        html += `<div style="margin-bottom: 3px;"><strong>${cleanLatex(label)}:</strong> ${cleanLatex(value)}</div>`;
      }
      html += '</div>';
    } else {
      // Plain content
      const plainContent = content
        .replace(/\\resumeSubHeadingListStart|\\resumeSubHeadingListEnd/g, '')
        .replace(/\\resumeItemListStart|\\resumeItemListEnd/g, '')
        .replace(/\\textbf\{([^}]*)\}:?\s*/g, '<strong>$1:</strong> ')
        .replace(/\\item\s*/g, '')
        .replace(/\\\\/g, '<br>')
        .replace(/\\[a-zA-Z]+/g, '')
        .replace(/[{}]/g, '')
        .trim();

      if (plainContent) {
        html += `<div style="font-size: 9pt;">${plainContent}</div>`;
      }
    }
  }

  return html;
}

function parseResumeItems(content: string): string[] {
  const items: string[] = [];

  // Match \resumeItem{...} with nested braces support
  const itemRegex = /\\resumeItem\{/g;
  let match;

  while ((match = itemRegex.exec(content)) !== null) {
    const startIdx = match.index + match[0].length;
    let braceCount = 1;
    let endIdx = startIdx;

    while (braceCount > 0 && endIdx < content.length) {
      if (content[endIdx] === '{') braceCount++;
      else if (content[endIdx] === '}') braceCount--;
      endIdx++;
    }

    const itemText = content.substring(startIdx, endIdx - 1);
    items.push(cleanLatex(itemText));
  }

  return items;
}

function parseGenericSection(content: string): string {
  let html = '';

  // Check for itemize environment
  const itemizeMatch = content.match(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/);
  if (itemizeMatch) {
    const itemContent = itemizeMatch[1];
    const items = itemContent.split(/\\item/).filter(s => s.trim());

    if (items.length > 0) {
      html += '<ul style="margin: 4px 0 0 0; padding-left: 18px; list-style-type: disc;">';
      for (const item of items) {
        html += `<li style="font-size: 9pt; margin-bottom: 2px;">${cleanLatex(item)}</li>`;
      }
      html += '</ul>';
    }
  } else {
    // Plain paragraph content
    const plainContent = content
      .replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>')
      .replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>')
      .replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>')
      .replace(/\\\\/g, '<br>')
      .replace(/\\[a-zA-Z]+/g, '')
      .replace(/[{}]/g, '')
      .trim();

    if (plainContent) {
      html += `<div style="font-size: 9pt;">${plainContent}</div>`;
    }
  }

  return html;
}

function cleanLatex(text: string): string {
  return text
    .replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>')
    .replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>')
    .replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>')
    .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, '$1')
    .replace(/\\underline\{([^}]*)\}/g, '$1')
    .replace(/\\small\{([^}]*)\}/g, '$1')
    .replace(/\\normalsize/g, '')
    .replace(/\\LaTeX/g, 'LaTeX')
    .replace(/\$\\vert\$/g, '|')
    .replace(/\$\|\$/g, '|')
    .replace(/\\,/g, ' ')
    .replace(/~/g, ' ')
    .replace(/``/g, '"')
    .replace(/''/g, '"')
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\_/g, '_')
    .replace(/\\#/g, '#')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '')
    .trim();
}
