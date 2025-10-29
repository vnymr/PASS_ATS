/**
 * Clean HTML entities and tags from text
 */
export function cleanHtmlText(text: string): string {
  if (!text) return '';

  // Remove HTML tags
  let cleaned = text.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  const entityMap: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&mdash;': '-',
    '&ndash;': '-',
    '&hellip;': '...',
    '&rsquo;': "'",
    '&lsquo;': "'",
    '&rdquo;': '"',
    '&ldquo;': '"',
  };

  // Replace entities
  cleaned = cleaned.replace(/&[a-z]+;|&#\d+;/gi, (match) => {
    return entityMap[match.toLowerCase()] || match;
  });

  // Remove excessive whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Convert multiple line breaks to paragraphs
  cleaned = cleaned.replace(/\n\s*\n/g, '\n\n');

  return cleaned;
}

/**
 * Convert HTML to readable plain text with basic formatting
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';

  let text = html;

  // First: Decode HTML entities BEFORE processing tags
  // This handles cases where entities are used inside tags
  const entityMap: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#34;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&#160;': ' ',
    '&#32;': ' ',
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…',
    '&rsquo;': "'",
    '&lsquo;': "'",
    '&rdquo;': '"',
    '&ldquo;': '"',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&deg;': '°',
    '&plusmn;': '±',
    '&times;': '×',
    '&divide;': '÷',
  };

  // Use DOM for entity decoding (most reliable method)
  try {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    text = textarea.value;
  } catch (e) {
    // Fallback: Replace named entities
    Object.keys(entityMap).forEach(entity => {
      const regex = new RegExp(entity, 'gi');
      text = text.replace(regex, entityMap[entity]);
    });

    // Decode numeric entities (&#123; or &#xAB;)
    text = text.replace(/&#(\d+);/g, (_match, dec) => {
      return String.fromCharCode(parseInt(dec, 10));
    });
    text = text.replace(/&#x([0-9a-f]+);/gi, (_match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
  }

  // Step 2: Handle special formatting elements
  // Convert list items to bullets
  text = text.replace(/<li[^>]*>/gi, '\n• ');
  text = text.replace(/<\/li>/gi, '');

  // Convert strong/bold to emphasis (keep the text, remove tags)
  text = text.replace(/<(strong|b)[^>]*>/gi, '');
  text = text.replace(/<\/(strong|b)>/gi, '');

  // Convert emphasis/italic (keep the text, remove tags)
  text = text.replace(/<(em|i)[^>]*>/gi, '');
  text = text.replace(/<\/(em|i)>/gi, '');

  // Step 3: Convert block elements to line breaks
  // Handle headings
  text = text.replace(/<h[1-6][^>]*>/gi, '\n\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n');

  // Handle paragraphs and divs
  text = text.replace(/<(p|div)[^>]*>/gi, '\n');
  text = text.replace(/<\/(p|div)>/gi, '\n');

  // Handle line breaks
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Handle list containers
  text = text.replace(/<(ul|ol)[^>]*>/gi, '\n');
  text = text.replace(/<\/(ul|ol)>/gi, '\n');

  // Handle table elements
  text = text.replace(/<(tr|td|th)[^>]*>/gi, ' ');
  text = text.replace(/<\/(tr|td|th)>/gi, ' ');
  text = text.replace(/<\/?table[^>]*>/gi, '\n');

  // Handle other common block elements
  text = text.replace(/<(section|article|header|footer|aside|nav|main)[^>]*>/gi, '\n');
  text = text.replace(/<\/(section|article|header|footer|aside|nav|main)>/gi, '\n');

  // Step 4: Remove all remaining HTML tags (including class, style attributes)
  text = text.replace(/<[^>]*>/g, '');

  // Step 5: Clean up whitespace and formatting
  // Replace multiple spaces with single space
  text = text.replace(/[ \t]+/g, ' ');

  // Split into lines and clean each line
  const lines = text.split('\n').map(line => line.trim());

  // Filter out empty lines
  const nonEmptyLines = lines.filter(line => line.length > 0);

  // Join lines with double newlines for paragraph separation
  text = nonEmptyLines.join('\n\n');

  // Remove excessive line breaks (more than 2 consecutive)
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}
