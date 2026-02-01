/**
 * Lightweight Markdown Renderer for Robot Companion
 * Supports: Bold, Italic, Links, Lists, Inline Code, Code Blocks
 */
export class MarkdownRenderer {
  /**
   * Parse markdown text to HTML
   * @param {string} text - Markdown text
   * @returns {string} HTML string
   */
  static parse(text) {
    if (!text) return '';

    // Escape HTML first to prevent XSS (basic)
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 1. Code Blocks
    // Note: We handle code blocks first to avoid parsing markdown inside them
    const codeBlocks = [];
    html = html.replace(/```(\w*)([\s\S]*?)```/g, (match, lang, code) => {
      // Use a placeholder WITHOUT underscores or asterisks to avoid conflict
      const placeholder = `[[[CODEBLOCK${codeBlocks.length}]]]`;
      codeBlocks.push({
        lang: lang || '',
        code: code.trim(),
        full: match,
      });
      return placeholder;
    });

    // 2. Inline Code
    const inlineCodes = [];
    html = html.replace(/`([^`]+)`/g, (match, code) => {
      const placeholder = `[[[INLINECODE${inlineCodes.length}]]]`;
      inlineCodes.push(code);
      return placeholder;
    });

    // 3. Headers
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

    // 4. Bold & Italic
    // Use non-greedy matchers
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');

    // 5. Links - with sanitization
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
      // Prevent javascript: protocol
      if (url.trim().toLowerCase().startsWith('javascript:')) {
        return label; // Return just text if unsafe
      }
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });

    // 6. Lists
    // Unordered lists
    html = html.replace(/^\s*-\s+(.*)/gm, '<ul><li>$1</li></ul>');
    html = html.replace(/^\s*\*\s+(.*)/gm, '<ul><li>$1</li></ul>');
    // Fix consecutive lists
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    // Ordered lists
    html = html.replace(/^\s*\d+\.\s+(.*)/gm, '<ol><li>$1</li></ol>');
    // Fix consecutive ordered lists
    html = html.replace(/<\/ol>\s*<ol>/g, '');

    // 7. Paragraphs / Line Breaks
    // Replace double newlines with paragraphs, single with br

    // Simple line processing
    html = html.replace(/\n\n/g, '<br><br>');
    html = html.replace(/\n/g, '<br>');

    // Restore Inline Code
    inlineCodes.forEach((code, i) => {
      html = html.replace(
        `[[[INLINECODE${i}]]]`,
        `<code class="inline-code">${code}</code>`,
      );
    });

    // Restore Code Blocks with Syntax Highlighting styling hooks
    codeBlocks.forEach((block, i) => {
      const langClass = block.lang ? ` class="language-${block.lang}"` : '';
      const content = `<pre><code${langClass}>${block.code}</code></pre>`;
      html = html.replace(`[[[CODEBLOCK${i}]]]`, content);
    });

    return html;
  }
}
