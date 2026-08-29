/**
 * Chronology — set builder.
 *
 * Turns a plain pasted list of "date | text | note" lines into a validated
 * preview and a downloadable JSON file matching the format in SCHEMA.md.
 * This is the only place a teacher needs to touch to author a set — the
 * output file is the entire handoff to the live site.
 */

(function () {
  const titleInput = document.getElementById('set-title');
  const slugInput = document.getElementById('set-slug');
  const descriptionInput = document.getElementById('set-description');
  const eventListInput = document.getElementById('event-list');

  const summaryEl = document.getElementById('preview-summary');
  const tableWrap = document.getElementById('preview-table-wrap');
  const issuesEl = document.getElementById('issues');
  const downloadBtn = document.getElementById('download-btn');
  const testBtn = document.getElementById('test-btn');
  const downloadHint = document.getElementById('download-hint');
  const slugPreview = document.getElementById('slug-preview');

  let slugManuallyEdited = false;
  let lastValidSet = null; // the object we'd write out, once everything checks out

  function slugify(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  titleInput.addEventListener('input', () => {
    if (!slugManuallyEdited) {
      slugInput.value = slugify(titleInput.value);
    }
    scheduleUpdate();
  });
  slugInput.addEventListener('input', () => {
    slugManuallyEdited = true;
    scheduleUpdate();
  });
  descriptionInput.addEventListener('input', scheduleUpdate);
  eventListInput.addEventListener('input', scheduleUpdate);

  let updateTimer = null;
  function scheduleUpdate() {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(update, 150);
  }

  function parseLines(raw) {
    const lines = raw.split('\n');
    const rows = [];
    const issues = [];

    lines.forEach((line, idx) => {
      const lineNumber = idx + 1;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const parts = trimmed.split('|').map((p) => p.trim());
      const [dateRaw, text, note] = parts;

      if (!dateRaw || !text) {
        issues.push(`Line ${lineNumber}: expected a date and event text separated by "|" — got "${trimmed}".`);
        rows.push({ lineNumber, dateRaw: dateRaw || '', text: text || '', note: note || '', error: 'Missing date or text' });
        return;
      }

      const parsed = parseEventDate(dateRaw);
      if (!parsed) {
        issues.push(`Line ${lineNumber}: couldn't understand the date "${dateRaw}" — try YYYY, YYYY-MM, or YYYY-MM-DD.`);
        rows.push({ lineNumber, dateRaw, text, note: note || '', error: 'Unrecognised date' });
        return;
      }

      rows.push({
        lineNumber,
        dateRaw,
        text,
        note: note || '',
        parsed,
        displayDate: formatDisplayDate(parsed)
      });
    });

    return { rows, issues };
  }

  function renderTable(rows) {
    tableWrap.innerHTML = '';
    if (!rows.length) {
      tableWrap.textContent = '';
      return;
    }
    const table = document.createElement('table');
    table.className = 'preview-table';
    table.innerHTML = `
      <thead>
        <tr><th>#</th><th>Date</th><th>Event</th><th>Note</th></tr>
      </thead>
    `;
    const tbody = document.createElement('tbody');
    let validSeen = 0;

    rows.forEach((row) => {
      const tr = document.createElement('tr');
      if (row.error) tr.className = 'row-error';

      const numCell = document.createElement('td');
      numCell.textContent = String(row.lineNumber);
      tr.appendChild(numCell);

      const dateCell = document.createElement('td');
      dateCell.textContent = row.error ? row.dateRaw : row.displayDate;
      tr.appendChild(dateCell);

      const textCell = document.createElement('td');
      textCell.textContent = row.text;
      if (!row.error) {
        validSeen += 1;
        if (validSeen === 1) {
          const tag = document.createElement('span');
          tag.className = 'anchor-tag';
          tag.textContent = 'Anchor';
          textCell.appendChild(tag);
        }
      }
      tr.appendChild(textCell);

      const noteCell = document.createElement('td');
      noteCell.textContent = row.note;
      tr.appendChild(noteCell);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableWrap.appendChild(table);
  }

  function update() {
    const title = titleInput.value.trim();
    const slug = slugInput.value.trim();
    const description = descriptionInput.value.trim();
    const { rows, issues } = parseLines(eventListInput.value);

    renderTable(rows);
    issuesEl.innerHTML = '';
    issues.forEach((msg) => {
      const li = document.createElement('li');
      li.textContent = msg;
      issuesEl.appendChild(li);
    });

    const validRows = rows.filter((r) => !r.error);
    summaryEl.textContent = rows.length
      ? `${validRows.length} of ${rows.length} line(s) look good.`
      : 'Paste your events on the left to see a preview here.';

    slugPreview.textContent = slug ? `Shareable link: ?set=${slug}` : '';

    const blockers = [];
    if (!title) blockers.push('Give the set a title.');
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) blockers.push('Give the set a link using only lowercase letters, numbers, and hyphens.');
    if (issues.length) blockers.push('Fix the highlighted line(s) above.');
    if (validRows.length < 2) blockers.push('Add at least 2 events.');

    if (blockers.length) {
      lastValidSet = null;
      downloadBtn.disabled = true;
      testBtn.disabled = true;
      downloadHint.textContent = blockers.join(' ');
      return;
    }

    lastValidSet = {
      id: slug,
      title,
      description: description || undefined,
      events: validRows.map((r) => {
        const event = { date: r.dateRaw, text: r.text };
        if (r.note) event.note = r.note;
        return event;
      })
    };
    downloadBtn.disabled = false;
    testBtn.disabled = false;
    downloadHint.textContent = `Ready. This will save as "${slug}.json".`;
  }

  downloadBtn.addEventListener('click', () => {
    if (!lastValidSet) return;
    const json = JSON.stringify(lastValidSet, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lastValidSet.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  testBtn.addEventListener('click', () => {
    if (!lastValidSet) return;
    try {
      localStorage.setItem('chronology-preview-set', JSON.stringify(lastValidSet));
    } catch (e) {
      alert('This browser is blocking local storage, so a test round can’t be opened here.');
      return;
    }
    window.open('index.html?preview=1', '_blank');
  });

  update();
})();
