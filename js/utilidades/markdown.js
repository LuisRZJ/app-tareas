/**
 * renderMd — Motor de renderizado Markdown → HTML (vanilla, sin dependencias).
 *
 * Soporta:
 *   Bloques
 *     - Encabezados            # h1  ## h2  ### h3  #### h4
 *     - Bloques de código       ```lang … ```
 *     - Citas                  > texto
 *     - Listas no ordenadas    - / * / +
 *     - Listas ordenadas       1.
 *     - Listas de tareas       - [ ] / - [x]
 *     - Reglas horizontales    --- / *** / ___
 *     - Tablas                 | a | b |  (con alineación :--: etc.)
 *     - Párrafos
 *
 *   Inline
 *     - Negrita                **text** / __text__
 *     - Cursiva                *text*   / _text_
 *     - Negrita + cursiva      ***text***
 *     - Tachado                ~~text~~
 *     - Código inline          `code`
 *     - Links                  [text](url)
 *     - Imágenes               ![alt](url)
 *     - Resaltado              ==text==
 *     - Salto de línea         doble espacio o \
 */

function renderMd(src) {
  if (!src) return '';
  const lines = src.split('\n');
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Blank line ──
    if (/^\s*$/.test(line)) { i++; continue; }

    // ── Horizontal rule ──
    if (/^(\s*[-*_]\s*){3,}$/.test(line)) {
      html += '<hr>';
      i++; continue;
    }

    // ── Code block ──
    if (/^```/.test(line.trimStart())) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trimStart())) {
        codeLines.push(_escHtml(lines[i]));
        i++;
      }
      i++; // skip closing ```
      const cls = lang ? ` class="lang-${_escAttr(lang)}"` : '';
      html += `<pre><code${cls}>${codeLines.join('\n')}</code></pre>`;
      continue;
    }

    // ── Heading ──
    const hMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      const lvl = hMatch[1].length;
      html += `<h${lvl}>${_inline(hMatch[2])}</h${lvl}>`;
      i++; continue;
    }

    // ── Table ──
    if (/^\|.+\|/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|/.test(lines[i + 1])) {
      html += _parseTable(lines, i);
      // skip header + separator + body rows
      i += 2;
      while (i < lines.length && /^\|.+\|/.test(lines[i])) i++;
      continue;
    }

    // ── Blockquote ──
    if (/^>\s?/.test(line)) {
      const bqLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        bqLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      html += `<blockquote>${renderMd(bqLines.join('\n'))}</blockquote>`;
      continue;
    }

    // ── Unordered / task list ──
    if (/^[\s]*[-*+]\s/.test(line)) {
      html += _parseList(lines, i, 'ul');
      while (i < lines.length && /^[\s]*[-*+]\s/.test(lines[i])) i++;
      continue;
    }

    // ── Ordered list ──
    if (/^[\s]*\d+\.\s/.test(line)) {
      html += _parseList(lines, i, 'ol');
      while (i < lines.length && /^[\s]*\d+\.\s/.test(lines[i])) i++;
      continue;
    }

    // ── Paragraph (default) ──
    const paraLines = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^```/.test(lines[i].trimStart()) &&
           !/^#{1,4}\s/.test(lines[i]) && !/^>\s?/.test(lines[i]) &&
           !/^(\s*[-*_]\s*){3,}$/.test(lines[i]) && !/^\|.+\|/.test(lines[i]) &&
           !/^[\s]*[-*+]\s/.test(lines[i]) && !/^[\s]*\d+\.\s/.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    html += `<p>${_inline(paraLines.join('\n'))}</p>`;
  }

  return html;
}

/* ── Inline rendering ── */
function _inline(text) {
  let s = _escHtml(text);

  // Images (before links)
  s = s.replace(/!\[([^\]]*)]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  // Links
  s = s.replace(/\[([^\]]+)]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // Bold + italic ***text*** or ___text___
  s = s.replace(/\*{3}(.+?)\*{3}/g, '<strong><em>$1</em></strong>');
  s = s.replace(/_{3}(.+?)_{3}/g, '<strong><em>$1</em></strong>');
  // Bold **text** or __text__
  s = s.replace(/\*{2}(.+?)\*{2}/g, '<strong>$1</strong>');
  s = s.replace(/_{2}(.+?)_{2}/g, '<strong>$1</strong>');
  // Italic *text* or _text_
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>');
  // Strikethrough
  s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');
  // Highlight ==text==
  s = s.replace(/==(.+?)==/g, '<mark>$1</mark>');
  // Inline code
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Line breaks (trailing double-space or backslash)
  s = s.replace(/\s{2,}\n/g, '<br>');
  s = s.replace(/\\\n/g, '<br>');

  return s;
}

/* ── List parser ── */
function _parseList(lines, start, tag) {
  const items = [];
  let i = start;
  const listRe = tag === 'ul' ? /^[\s]*[-*+]\s(.*)$/ : /^[\s]*\d+\.\s(.*)$/;
  while (i < lines.length) {
    const m = lines[i].match(listRe);
    if (!m) break;
    let content = m[1];
    // Task list support
    const taskMatch = content.match(/^\[([ xX])]\s?(.*)/);
    if (taskMatch) {
      const checked = taskMatch[1] !== ' ' ? ' checked disabled' : ' disabled';
      items.push(`<li class="task-li"><input type="checkbox"${checked}> ${_inline(taskMatch[2])}</li>`);
    } else {
      items.push(`<li>${_inline(content)}</li>`);
    }
    i++;
  }
  return `<${tag}>${items.join('')}</${tag}>`;
}

/* ── Table parser ── */
function _parseTable(lines, start) {
  const headCells = _tableCells(lines[start]);
  const aligns    = _tableAligns(lines[start + 1]);
  let t = '<table><thead><tr>';
  headCells.forEach((c, j) => {
    const a = aligns[j] ? ` style="text-align:${aligns[j]}"` : '';
    t += `<th${a}>${_inline(c)}</th>`;
  });
  t += '</tr></thead><tbody>';
  let i = start + 2;
  while (i < lines.length && /^\|.+\|/.test(lines[i])) {
    const cells = _tableCells(lines[i]);
    t += '<tr>';
    cells.forEach((c, j) => {
      const a = aligns[j] ? ` style="text-align:${aligns[j]}"` : '';
      t += `<td${a}>${_inline(c)}</td>`;
    });
    t += '</tr>';
    i++;
  }
  t += '</tbody></table>';
  return t;
}

function _tableCells(line) {
  return line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
}
function _tableAligns(line) {
  return _tableCells(line).map(c => {
    if (/^:-+:$/.test(c)) return 'center';
    if (/^-+:$/.test(c))  return 'right';
    if (/^:-+$/.test(c))  return 'left';
    return '';
  });
}

/* ── HTML escape (for Markdown source) ── */
function _escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _escAttr(s) {
  return s.replace(/[^a-zA-Z0-9_-]/g, '');
}
