/**
 * Lightweight & Secure Markdown Renderer
 * Converts Markdown text into sanitized HTML with syntax styling and copyable code blocks.
 */

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

export function renderMarkdown(rawText) {
  if (!rawText) return '';

  let text = rawText;

  // 1. Extract code blocks first to prevent inner formatting corruption
  const codeBlocks = [];
  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push({ lang: lang || 'code', code: code.trimEnd() });
    return placeholder;
  });

  // 2. Escape HTML on the rest of the text
  text = escapeHtml(text);

  // 3. Inline code
  text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // 4. Headers
  text = text.replace(/^### (.*$)/gim, '<h4 class="md-heading">$1</h4>');
  text = text.replace(/^## (.*$)/gim, '<h3 class="md-heading">$1</h3>');
  text = text.replace(/^# (.*$)/gim, '<h2 class="md-heading">$1</h2>');

  // 5. Bold & Italic
  text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
  text = text.replace(/_(.*?)_/g, '<em>$1</em>');

  // 6. Blockquotes
  text = text.replace(/^\> (.*$)/gim, '<blockquote class="md-quote">$1</blockquote>');

  // 7. Unordered lists
  text = text.replace(/^[\*\-] (.*$)/gim, '<li class="md-li">$1</li>');
  text = text.replace(/((?:<li class="md-li">.*<\/li>\s*)+)/g, '<ul class="md-ul">$1</ul>');

  // 8. Ordered lists
  text = text.replace(/^\d+\. (.*$)/gim, '<li class="md-oli">$1</li>');
  text = text.replace(/((?:<li class="md-oli">.*<\/li>\s*)+)/g, '<ol class="md-ol">$1</ol>');

  // 9. Links (safe http/https)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>');

  // 10. Paragraphs / Linebreaks
  const paragraphs = text.split(/\n{2,}/);
  text = paragraphs
    .map(p => {
      p = p.trim();
      if (!p) return '';
      if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<ol') || p.startsWith('<blockquote') || p.startsWith('__CODE_BLOCK_')) {
        return p;
      }
      return `<p class="md-p">${p.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');

  // 11. Restore Code Blocks with Copy button and styling
  codeBlocks.forEach((block, index) => {
    const placeholder = `__CODE_BLOCK_${index}__`;
    const escapedCode = escapeHtml(block.code);
    const blockHtml = `
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span class="code-lang-tag">${block.lang}</span>
          <button type="button" class="btn-copy-code" data-code="${encodeURIComponent(block.code)}" title="Copy code">
            <svg class="copy-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span class="copy-text">Copy</span>
          </button>
        </div>
        <pre class="code-pre"><code class="code-content language-${block.lang}">${escapedCode}</code></pre>
      </div>
    `;
    text = text.replace(placeholder, blockHtml);
  });

  return text;
}
