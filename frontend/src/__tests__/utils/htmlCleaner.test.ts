import { describe, it, expect } from 'vitest';
import { cleanHtmlText, htmlToPlainText } from '../../utils/htmlCleaner';

describe('cleanHtmlText', () => {
  it('should remove HTML tags', () => {
    const html = '<p>Hello <strong>world</strong></p>';
    const result = cleanHtmlText(html);

    expect(result).toBe('Hello world');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('should decode HTML entities', () => {
    const html = 'Hello &amp; welcome &lt;world&gt;';
    const result = cleanHtmlText(html);

    expect(result).toBe('Hello & welcome <world>');
  });

  it('should handle multiple whitespace', () => {
    const html = 'Hello     world    test';
    const result = cleanHtmlText(html);

    expect(result).toBe('Hello world test');
  });

  it('should handle empty string', () => {
    expect(cleanHtmlText('')).toBe('');
    expect(cleanHtmlText(null as any)).toBe('');
    expect(cleanHtmlText(undefined as any)).toBe('');
  });

  it('should preserve basic structure', () => {
    const html = 'Line 1\n\nLine 2\n\nLine 3';
    const result = cleanHtmlText(html);

    expect(result).toContain('\n\n');
  });

  it('should decode common entities', () => {
    const html = '&mdash; test &hellip; &nbsp;';
    const result = cleanHtmlText(html);

    expect(result).toContain('-');
    expect(result).toContain('...');
  });
});

describe('htmlToPlainText', () => {
  it('should convert HTML paragraphs to plain text', () => {
    const html = '<p>Paragraph 1</p><p>Paragraph 2</p>';
    const result = htmlToPlainText(html);

    expect(result).toContain('Paragraph 1');
    expect(result).toContain('Paragraph 2');
    expect(result).not.toContain('<p>');
  });

  it('should convert list items to bullets', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const result = htmlToPlainText(html);

    expect(result).toContain('• Item 1');
    expect(result).toContain('• Item 2');
  });

  it('should remove strong/bold tags but keep text', () => {
    const html = 'This is <strong>bold</strong> text';
    const result = htmlToPlainText(html);

    expect(result).toContain('bold');
    expect(result).not.toContain('<strong>');
  });

  it('should convert headings with line breaks', () => {
    const html = '<h1>Title</h1><p>Content</p>';
    const result = htmlToPlainText(html);

    expect(result).toContain('Title');
    expect(result).toContain('Content');
    // Headings should add line breaks
    expect(result.split('\n').length).toBeGreaterThan(1);
  });

  it('should handle line breaks correctly', () => {
    const html = 'Line 1<br/>Line 2<br>Line 3';
    const result = htmlToPlainText(html);

    expect(result.split('\n').length).toBeGreaterThanOrEqual(3);
  });

  it('should remove all HTML tags', () => {
    const html = '<div class="test" style="color: red">Content</div>';
    const result = htmlToPlainText(html);

    expect(result).toBe('Content');
    expect(result).not.toMatch(/<[^>]+>/);
  });

  it('should handle nested HTML', () => {
    const html = '<div><p>Nested <strong>content</strong></p></div>';
    const result = htmlToPlainText(html);

    expect(result).toContain('Nested');
    expect(result).toContain('content');
    expect(result).not.toMatch(/<[^>]+>/);
  });

  it('should decode HTML entities', () => {
    const html = '&amp; &lt; &gt; &quot;';
    const result = htmlToPlainText(html);

    expect(result).toContain('&');
    expect(result).toContain('<');
    expect(result).toContain('>');
    expect(result).toContain('"');
  });

  it('should handle empty input', () => {
    expect(htmlToPlainText('')).toBe('');
    expect(htmlToPlainText(null as any)).toBe('');
    expect(htmlToPlainText(undefined as any)).toBe('');
  });

  it('should clean up excessive whitespace', () => {
    const html = '   Multiple    spaces    here   ';
    const result = htmlToPlainText(html);

    // Should have single spaces, not multiple
    expect(result).not.toMatch(/  +/);
  });

  it('should handle table elements', () => {
    const html = '<table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>';
    const result = htmlToPlainText(html);

    expect(result).toContain('Cell 1');
    expect(result).toContain('Cell 2');
  });
});




