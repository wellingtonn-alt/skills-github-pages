/**
 * Chronology — game screen logic.
 *
 * Flow: one event starts on the timeline as a free "anchor". The rest are
 * dealt one at a time, in a random order, and the player taps a gap in the
 * timeline to say where it belongs, then taps again (or presses the
 * confirm button) to lock it in. Dates stay hidden until a card is
 * committed. A correct guess scores a point and reveals the date in place;
 * a wrong guess scores nothing and the card slides to its true position,
 * which then also becomes visible.
 *
 * Nothing here reads from or writes to the network — the only outside
 * fetch is the one-time load of the set's own JSON file.
 */

(function () {
  const app = document.getElementById('app');
  const displayToggle = document.getElementById('display-toggle');

  // ---------- Display-size toggle (a per-device UI preference only) ----------
  function initDisplayToggle() {
    const saved = localStorage.getItem('chronology-display-large') === '1';
    setDisplayLarge(saved);
    displayToggle.addEventListener('click', () => {
      setDisplayLarge(!document.body.classList.contains('display-large'));
    });
  }

  function setDisplayLarge(on) {
    document.body.classList.toggle('display-large', on);
    displayToggle.setAttribute('aria-pressed', String(on));
    try {
      localStorage.setItem('chronology-display-large', on ? '1' : '0');
    } catch (e) {
      /* localStorage unavailable (e.g. locked-down Chromebook profile) — toggle still works for this page view */
    }
  }

  // ---------- Loading a set ----------

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function isValidSlug(slug) {
    return /^[a-z0-9-]+$/.test(slug);
  }

  async function loadAndStart() {
    const previewFlag = getParam('preview');
    const slug = getParam('set');

    if (previewFlag) {
      let raw;
      try {
        raw = JSON.parse(localStorage.getItem('chronology-preview-set') || 'null');
      } catch (e) {
        raw = null;
      }
      if (!raw) {
        renderError('No preview found', 'Open this page from the "Play a test round" button on the builder page.');
        return;
      }
      startFromRawSet(raw, { isPreview: true });
      return;
    }

    if (!slug) {
      renderHome();
      return;
    }

    if (!isValidSlug(slug)) {
      renderError('That link looks wrong', 'Set links only contain lowercase letters, numbers, and hyphens.');
      return;
    }

    let response;
    try {
      response = await fetch(`sets/${slug}.json`, { cache: 'no-store' });
    } catch (e) {
      renderError('Couldn’t load that set', 'There was a network problem loading this set’s file. Try reloading the page.');
      return;
    }

    if (!response.ok) {
      renderError(
        `We couldn’t find a set called “${slug}”`,
        'Check the link your teacher shared, or pick a set below.'
      );
      return;
    }

    let raw;
    try {
      raw = await response.json();
    } catch (e) {
      renderError('This set’s file is broken', 'The JSON in this set’s file couldn’t be read. Ask whoever made it to check it in the builder.');
      return;
    }

    startFromRawSet(raw, { isPreview: false });
  }

  function startFromRawSet(raw, opts) {
    const result = validateSet(raw);
    if (!result.ok) {
      renderError('This set has a problem', null, result.errors);
      return;
    }
    startGame(result.set, opts || {});
  }

  // ---------- Validation ----------

  function validateSet(raw) {
    const errors = [];
    if (!raw || typeof raw !== 'object') {
      return { ok: false, errors: ['The file is not a JSON object.'] };
    }
    if (!raw.title || typeof raw.title !== 'string') {
      errors.push('Missing a "title".');
    }
    if (!Array.isArray(raw.events) || raw.events.length < 2) {
      errors.push('"events" must be a list with at least 2 events.');
    }

    const events = [];
    if (Array.isArray(raw.events)) {
      raw.events.forEach((ev, idx) => {
        if (!ev || typeof ev.text !== 'string' || !ev.text.trim()) {
          errors.push(`Event ${idx + 1} is missing "text".`);
          return;
        }
        const parsed = parseEventDate(ev.date);
        if (!parsed) {
          errors.push(`Event ${idx + 1} ("${ev.text}") has a date that isn't in a recognised format: "${ev.date}".`);
          return;
        }
        events.push({
          id: ev.id || `evt-${idx + 1}`,
          text: ev.text,
          note: typeof ev.note === 'string' ? ev.note : '',
          date: parsed,
          displayDate: typeof ev.displayDate === 'string' && ev.displayDate ? ev.displayDate : formatDisplayDate(parsed)
        });
      });
    }

    if (errors.length) {
      return { ok: false, errors };
    }

    return {
      ok: true,
      set: {
        title: raw.title,
        description: typeof raw.description === 'string' ? raw.description : '',
        events
      }
    };
  }

  // ---------- Game state ----------

  let state = null;

  function shuffled(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function startGame(setData, opts) {
    const anchor = setData.events[0];
    const rest = shuffled(setData.events.slice(1));
    state = {
      setData,
      isPreview: !!opts.isPreview,
      timeline: [Object.assign({ revealed: true }, anchor)],
      deck: rest,
      current: null,
      selectedSlot: null,
      score: 0,
      total: rest.length,
      phase: 'playing',
      feedback: '',
      feedbackKind: '',
      lastInsertedId: null,
      lastInsertedKind: null
    };
    dealNext();
  }

  function dealNext() {
    if (state.deck.length === 0) {
      state.phase = 'end';
      state.current = null;
    } else {
      state.current = state.deck.shift();
    }
    state.selectedSlot = null;
    render();
  }

  /** Slot i means "between timeline[i-1] and timeline[i]" (timeline is always kept in true chronological order). */
  function acceptableSlots(cardDate) {
    const value = dateSortValue(cardDate);
    const acceptable = [];
    for (let i = 0; i <= state.timeline.length; i++) {
      const leftOk = i === 0 || dateSortValue(state.timeline[i - 1].date) <= value;
      const rightOk = i === state.timeline.length || dateSortValue(state.timeline[i].date) >= value;
      if (leftOk && rightOk) acceptable.push(i);
    }
    return acceptable;
  }

  function selectSlot(i) {
    if (state.selectedSlot === i) {
      confirmPlacement();
      return;
    }
    state.selectedSlot = i;
    render();
  }

  function confirmPlacement() {
    if (state.selectedSlot === null || !state.current) return;
    const card = state.current;
    const acceptable = acceptableSlots(card.date);
    const isCorrect = acceptable.includes(state.selectedSlot);
    const insertAt = isCorrect ? state.selectedSlot : acceptable[0];

    const revealedCard = Object.assign({ revealed: true }, card);
    state.timeline.splice(insertAt, 0, revealedCard);

    if (isCorrect) {
      state.score += 1;
      state.feedback = `Correct — ${revealedCard.displayDate}.`;
      state.feedbackKind = 'good';
    } else {
      state.feedback = `Not quite. This happened on ${revealedCard.displayDate}, so it moves to its true spot.`;
      state.feedbackKind = 'bad';
    }
    state.lastInsertedId = revealedCard.id;
    state.lastInsertedKind = isCorrect ? 'correct-flash' : 'just-moved';
    state.current = null;
    state.selectedSlot = null;
    render();

    // Short pause so the player can read the feedback and see the card land, then deal the next one.
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 500 : 1100;
    setTimeout(dealNext, delay);
  }

  // ---------- Rendering ----------

  function render() {
    if (!state) return;
    if (state.phase === 'end') {
      renderEnd();
      return;
    }
    renderPlaying();
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    });
    (children || []).forEach((c) => c && node.appendChild(c));
    return node;
  }

  function renderPlaying() {
    app.innerHTML = '';

    const header = el('div', {});
    header.appendChild(el('h1', { class: 'title', text: state.setData.title }));
    if (state.setData.description) {
      header.appendChild(el('p', { class: 'subtitle', text: state.setData.description }));
    }
    app.appendChild(header);

    const placedCount = state.timeline.length - 1; // minus the free anchor
    const cardNumber = placedCount + 1;
    const statusRow = el('div', { class: 'status-row' }, [
      el('span', { text: `Card ${cardNumber} of ${state.total}` }),
      el('span', { class: 'score-badge', text: `Score: ${state.score} / ${state.total}` })
    ]);
    app.appendChild(statusRow);

    const feedback = el('div', { id: 'feedback', class: state.feedbackKind, role: 'status' });
    feedback.textContent = state.feedback;
    app.appendChild(feedback);

    if (state.current) {
      const dealCard = el('div', { class: 'deal-card' });
      dealCard.appendChild(el('span', { class: 'eyebrow', text: 'Place this event' }));
      dealCard.appendChild(document.createTextNode(state.current.text));
      app.appendChild(dealCard);
    }

    app.appendChild(renderTimeline());

    const confirmRow = el('div', { class: 'confirm-row' });
    if (state.selectedSlot !== null && state.current) {
      confirmRow.appendChild(el('button', {
        class: 'button',
        text: 'Confirm placement',
        onclick: () => confirmPlacement()
      }));
    } else {
      confirmRow.setAttribute('hidden', '');
    }
    app.appendChild(confirmRow);

    if (state.isPreview) {
      app.appendChild(el('p', { class: 'hint', text: 'Test round from the builder — nothing here gets saved.' }));
    }
  }

  function renderTimeline() {
    const container = el('div', { class: 'timeline', role: 'group', 'aria-label': 'Timeline. Choose where the current card belongs.' });

    if (!state.current) {
      // Between rounds: nothing to place yet, so show the timeline as a plain read-only list.
      state.timeline.forEach((item) => container.appendChild(renderTimelineItem(item)));
      return container;
    }

    const slotCount = state.timeline.length + 1;

    for (let i = 0; i < slotCount; i++) {
      const isSelected = state.selectedSlot === i;
      const label = i === 0 ? 'Place first, before everything else'
        : i === state.timeline.length ? 'Place last, after everything else'
        : 'Place here';
      const slot = el('button', {
        type: 'button',
        class: 'slot-button',
        'aria-pressed': String(isSelected),
        'aria-label': label,
        onclick: () => selectSlot(i),
        onkeydown: (e) => handleSlotKeydown(e, i)
      });
      slot.textContent = isSelected ? 'Tap again to confirm ↓' : '+';
      slot.dataset.slotIndex = String(i);
      container.appendChild(slot);

      if (i < state.timeline.length) {
        container.appendChild(renderTimelineItem(state.timeline[i]));
      }
    }
    return container;
  }

  function handleSlotKeydown(e, i) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const buttons = Array.from(document.querySelectorAll('.slot-button'));
    const dir = e.key === 'ArrowDown' ? 1 : -1;
    const next = buttons[i + dir];
    if (next) next.focus();
  }

  function renderTimelineItem(item) {
    const classes = ['timeline-item'];
    if (item.id === state.timeline[0].id) classes.push('anchor');
    if (item.id === state.lastInsertedId) classes.push(state.lastInsertedKind);

    const node = el('div', { class: classes.join(' ') });
    node.appendChild(el('span', { class: 'event-date', text: item.displayDate }));
    node.appendChild(document.createTextNode(item.text));
    if (item.note) {
      node.appendChild(el('p', { class: 'event-note', text: item.note }));
    }
    return node;
  }

  function renderEnd() {
    app.innerHTML = '';
    const box = el('div', { class: 'end-screen' });
    box.appendChild(el('h1', { class: 'title', text: state.setData.title }));
    box.appendChild(el('p', { class: 'end-score', text: `${state.score} / ${state.total}` }));
    box.appendChild(el('p', { class: 'end-note', text: 'Full timeline, in order:' }));

    const list = el('div', { class: 'timeline' });
    state.timeline.forEach((item) => list.appendChild(renderTimelineItem(item)));
    box.appendChild(list);

    const actions = el('div', { class: 'actions-row', style: 'justify-content:center;margin-top:1.5rem;' });
    actions.appendChild(el('button', { class: 'button', text: 'Play again', onclick: () => startGame(state.setData, { isPreview: state.isPreview }) }));
    if (!state.isPreview) {
      actions.appendChild(el('a', { class: 'button secondary', href: 'index.html', text: 'Back to all sets' }));
    }
    box.appendChild(actions);
    app.appendChild(box);
  }

  function renderHome() {
    app.innerHTML = '';
    app.appendChild(el('h1', { class: 'title', text: 'Chronology' }));
    app.appendChild(el('p', { class: 'subtitle', text: 'Place each event before or after the ones already on the timeline. Dates stay hidden until you commit a card.' }));

    if (typeof FEATURED_SETS !== 'undefined' && FEATURED_SETS.length) {
      const list = el('ul', { class: 'set-list' });
      FEATURED_SETS.forEach((s) => {
        const li = el('li', {});
        const link = el('a', { class: 'set-card', href: `?set=${encodeURIComponent(s.slug)}` });
        link.appendChild(el('h3', { text: s.title }));
        link.appendChild(el('p', { text: s.description }));
        li.appendChild(link);
        list.appendChild(li);
      });
      app.appendChild(list);
    }

    app.appendChild(el('p', { class: 'hint', text: 'Have a link from your teacher? Open it directly — it already picks the set for you.' }));
    app.appendChild(el('p', {}, [el('a', { href: 'builder.html', text: 'Build a new set →' })]));
  }

  function renderError(title, message, errors) {
    app.innerHTML = '';
    const box = el('div', { class: 'error-box' });
    box.appendChild(el('h2', { text: title }));
    if (message) box.appendChild(el('p', { text: message }));
    if (errors && errors.length) {
      const list = el('ul', { class: 'issue-list' });
      errors.forEach((e) => list.appendChild(el('li', { text: e })));
      box.appendChild(list);
    }
    app.appendChild(box);
    app.appendChild(el('p', {}, [el('a', { href: 'index.html', text: '← Back to all sets' })]));
  }

  initDisplayToggle();
  loadAndStart();
})();
