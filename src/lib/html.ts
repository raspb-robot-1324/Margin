const MAX_BYTES = 5 * 1024 * 1024;

export function extractTitle(html: string, fallback = "Untitled"): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = match?.[1]?.replace(/\s+/g, " ").trim();
  return title || fallback;
}

export function assertHtmlSize(html: string) {
  const bytes = new TextEncoder().encode(html).byteLength;
  if (bytes > MAX_BYTES) {
    throw new Error("Fichier trop volumineux (max 5 Mo).");
  }
  return bytes;
}

/** Inject selection bridge + (owner) inline editing / journal tools into HTML for iframe srcdoc. */
export function prepareHtmlForFrame(html: string, mode: "owner" | "share"): string {
  const bridge = `
<style id="margin-bridge-style">
  ::selection { background: rgba(185, 28, 28, 0.28); }
  .margin-hl {
    background: rgba(185, 28, 28, 0.28);
    outline: 1px solid rgba(185, 28, 28, 0.5);
    cursor: pointer;
    border-radius: 2px;
  }
  .margin-hl.is-active {
    background: rgba(185, 28, 28, 0.55) !important;
    outline: 3px solid #b91c1c !important;
    box-shadow: 0 0 0 6px rgba(185, 28, 28, 0.2);
  }
  body.margin-editing {
    caret-color: #b91c1c;
  }
  body.margin-editing [contenteditable="true"],
  body.margin-editing input,
  body.margin-editing textarea {
    outline-offset: 2px;
  }
  body.margin-editing input:focus,
  body.margin-editing textarea:focus,
  body.margin-editing [contenteditable="true"]:focus {
    outline: 2px solid rgba(185, 28, 28, 0.45);
  }
  body.margin-readonly {
    -webkit-user-modify: read-only;
  }
  body.margin-readonly [contenteditable],
  body.margin-readonly input,
  body.margin-readonly textarea,
  body.margin-readonly select {
    caret-color: transparent !important;
  }
  body.margin-readonly input,
  body.margin-readonly textarea,
  body.margin-readonly select {
    pointer-events: none;
  }
  /* Kill underscore placeholders from older journal templates */
  .field .value.blank::after,
  .value.blank::after {
    content: none !important;
    display: none !important;
  }
  body.margin-editing .shot {
    cursor: pointer;
    position: relative;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  body.margin-editing .shot:hover {
    border-color: #b91c1c;
    box-shadow: inset 0 0 0 1px rgba(185, 28, 28, 0.25);
  }
  body.margin-editing .shot.has-image .hint { display: none; }
  body.margin-editing .shot .margin-shot-actions {
    display: flex;
    gap: 0.35rem;
    margin-top: 0.4rem;
  }
  body.margin-editing .stamp {
    cursor: pointer;
    user-select: none;
  }
  body.margin-editing .stamp:hover {
    background: rgba(185, 28, 28, 0.08);
  }
  .margin-ui-btn {
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border: 1px dashed #6b7885;
    background: #fff;
    color: #3a4550;
    padding: 0.45rem 0.65rem;
    cursor: pointer;
  }
  .margin-ui-btn:hover {
    border-color: #b91c1c;
    color: #b91c1c;
  }
  .margin-add-shot {
    grid-column: 1 / -1;
    width: 100%;
  }
</style>
<script id="margin-bridge">
(function () {
  var MODE = ${JSON.stringify(mode)};
  var serializeTimer = null;
  var STATUSES = ['En cours', 'Fait', 'Bloqué', 'À préparer'];

  function cssPath(el) {
    if (!el || el.nodeType !== 1) return "";
    if (el.id) return '#' + CSS.escape(el.id);
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.body && parts.length < 12) {
      var parent = el.parentElement;
      if (!parent) break;
      var tag = el.tagName.toLowerCase();
      var siblings = Array.prototype.filter.call(parent.children, function (c) {
        return c.tagName === el.tagName;
      });
      if (siblings.length > 1) {
        var idx = siblings.indexOf(el) + 1;
        parts.unshift(tag + ':nth-of-type(' + idx + ')');
      } else {
        parts.unshift(tag);
      }
      el = parent;
    }
    return 'body > ' + parts.join(' > ');
  }

  function selectionPayload() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    var text = sel.toString().replace(/\\s+/g, ' ').trim();
    if (!text || text.length < 2) return null;
    var range = sel.getRangeAt(0);
    var startNode = range.startContainer;
    var endNode = range.endContainer;
    var startEl = startNode.nodeType === 3 ? startNode.parentElement : startNode;
    var endEl = endNode.nodeType === 3 ? endNode.parentElement : endNode;
    if (!startEl || !endEl) return null;
    return {
      selectedText: text.slice(0, 500),
      startPath: cssPath(startEl),
      startOffset: range.startOffset,
      endPath: cssPath(endEl),
      endOffset: range.endOffset
    };
  }

  document.addEventListener('mouseup', function (e) {
    if (e.target && e.target.closest && (
      e.target.closest('.shot') ||
      e.target.closest('.stamp') ||
      e.target.closest('.margin-ui-btn')
    )) return;
    var payload = selectionPayload();
    if (!payload) {
      parent.postMessage({ type: 'margin:clear-selection' }, '*');
      return;
    }
    parent.postMessage({ type: 'margin:selection', payload: payload }, '*');
  });

  document.addEventListener('keyup', function (e) {
    if (e.key === 'Escape') {
      parent.postMessage({ type: 'margin:clear-selection' }, '*');
    }
  });

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'margin:clear-highlights') {
      clearHighlights();
    }
    if (data.type === 'margin:focus') {
      var cid = String(data.commentId || '');
      var needle = data.anchor && data.anchor.selectedText ? data.anchor.selectedText : '';
      clearHighlights();
      if (needle) {
        tryHighlight({ selectedText: needle, commentId: cid });
      }
      var mark = document.querySelector('.margin-hl[data-cid=\"' + cid + '\"]');
      if (mark) {
        mark.classList.add('is-active');
        mark.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
    }
    if (data.type === 'margin:image-result' && MODE === 'owner') {
      var target = document.querySelector('[data-shot-id=\"' + String(data.shotId || '') + '\"]');
      // dataUrl may be a Supabase Storage public HTTPS URL (preferred) or legacy base64
      if (target && data.dataUrl) {
        fillShotWithImage(target, String(data.dataUrl));
        scheduleSerialize();
      }
    }
    if (data.type === 'margin:add-period' && MODE === 'owner') {
      addPeriod();
    }
  });

  function clearHighlights() {
    document.querySelectorAll('.margin-hl').forEach(function (n) {
      var p = n.parentNode;
      if (!p) return;
      while (n.firstChild) p.insertBefore(n.firstChild, n);
      p.removeChild(n);
      p.normalize();
    });
  }

  function tryHighlight(a) {
    if (!a || !a.selectedText) return;
    var needle = String(a.selectedText).replace(/\\s+/g, ' ').trim();
    if (!needle) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue) continue;
      if (node.parentElement && node.parentElement.closest && node.parentElement.closest('.margin-hl')) continue;
      var raw = node.nodeValue;
      var idx = raw.indexOf(needle);
      if (idx === -1) {
        // tolerate whitespace differences inside a single text node
        var collapsed = raw.replace(/\\s+/g, ' ');
        var cIdx = collapsed.indexOf(needle);
        if (cIdx === -1) continue;
        idx = raw.indexOf(needle.split(' ')[0]);
        if (idx === -1) continue;
      }
      var end = idx + needle.length;
      if (end > raw.length) end = raw.length;
      try {
        var range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, end);
        var mark = document.createElement('mark');
        mark.className = 'margin-hl';
        mark.setAttribute('data-cid', a.commentId || '');
        mark.contentEditable = 'false';
        mark.addEventListener('click', function (ev) {
          ev.preventDefault();
          parent.postMessage({ type: 'margin:click-highlight', commentId: mark.getAttribute('data-cid') }, '*');
        });
        range.surroundContents(mark);
      } catch (err) {}
      break;
    }
  }

  function unwrapHighlights(root) {
    root.querySelectorAll('.margin-hl').forEach(function (n) {
      var p = n.parentNode;
      if (!p) return;
      while (n.firstChild) p.insertBefore(n.firstChild, n);
      p.removeChild(n);
      p.normalize();
    });
  }

  function syncFormControls(clone) {
    var live = document.querySelectorAll('input, textarea, select');
    var cloned = clone.querySelectorAll('input, textarea, select');
    for (var i = 0; i < cloned.length; i++) {
      var src = live[i];
      var dst = cloned[i];
      if (!src || !dst) continue;
      var tag = dst.tagName;
      if (tag === 'TEXTAREA') {
        dst.textContent = src.value;
      } else if (tag === 'SELECT') {
        dst.setAttribute('value', src.value);
        Array.prototype.forEach.call(dst.options, function (opt) {
          if (opt.value === src.value) opt.setAttribute('selected', 'selected');
          else opt.removeAttribute('selected');
        });
      } else if (tag === 'INPUT') {
        var type = (src.type || 'text').toLowerCase();
        if (type === 'checkbox' || type === 'radio') {
          if (src.checked) dst.setAttribute('checked', 'checked');
          else dst.removeAttribute('checked');
        } else {
          dst.setAttribute('value', src.value);
        }
      }
    }
  }

  function serializeHtml() {
    var clone = document.documentElement.cloneNode(true);
    var bridge = clone.querySelector('#margin-bridge');
    var style = clone.querySelector('#margin-bridge-style');
    if (bridge) bridge.remove();
    if (style) style.remove();
    clone.querySelectorAll('.margin-ui-btn, .margin-shot-actions, #margin-file-input').forEach(function (n) {
      n.remove();
    });
    unwrapHighlights(clone);
    syncFormControls(clone);
    if (clone.body) {
      clone.body.removeAttribute('contenteditable');
      clone.body.classList.remove('margin-editing');
      clone.body.removeAttribute('spellcheck');
    }
    return '<!DOCTYPE html>\\n' + clone.outerHTML;
  }

  function scheduleSerialize() {
    if (MODE !== 'owner') return;
    clearTimeout(serializeTimer);
    serializeTimer = setTimeout(function () {
      parent.postMessage({ type: 'margin:html-changed', html: serializeHtml() }, '*');
    }, 200);
  }

  function padNum(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function nextPeriodNumber() {
    var max = 0;
    document.querySelectorAll('article.period:not(.template) .period-num').forEach(function (el) {
      var n = parseInt(el.textContent.replace(/\\D/g, ''), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return max + 1;
  }

  function ensureStamp(period) {
    var h2 = period.querySelector('.period-title h2');
    if (!h2) return null;
    var stamp = h2.querySelector('.stamp');
    if (!stamp) {
      stamp = document.createElement('span');
      stamp.className = 'stamp';
      stamp.textContent = 'À préparer';
      h2.appendChild(document.createTextNode(' '));
      h2.appendChild(stamp);
    }
    return stamp;
  }

  function wireStamp(stamp) {
    if (!stamp || stamp.dataset.marginWired) return;
    stamp.dataset.marginWired = '1';
    stamp.contentEditable = 'false';
    stamp.title = 'Cliquer pour changer le statut';
    stamp.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); });
    stamp.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var cur = (stamp.textContent || '').trim();
      var idx = STATUSES.indexOf(cur);
      stamp.textContent = STATUSES[(idx + 1) % STATUSES.length];
      scheduleSerialize();
    });
  }

  function emptyShot(label) {
    var shot = document.createElement('div');
    shot.className = 'shot';
    shot.innerHTML = '<span class="cap">' + label + '</span><p class="hint">Cliquer pour ajouter une capture</p>';
    return shot;
  }

  function requestImage(shotId) {
    parent.postMessage({ type: 'margin:request-image', shotId: shotId }, '*');
  }

  function fillShotWithImage(shot, dataUrl) {
    if (!shot || !dataUrl) return;
    var cap = shot.querySelector('.cap');
    var capText = cap ? cap.textContent : 'Capture';
    var shotId = shot.getAttribute('data-shot-id') || ('shot-' + Math.random().toString(36).slice(2, 10));
    shot.setAttribute('data-shot-id', shotId);
    shot.classList.add('has-image');
    shot.innerHTML = '';
    var capEl = document.createElement('span');
    capEl.className = 'cap';
    capEl.contentEditable = 'false';
    capEl.textContent = capText;
    var img = document.createElement('img');
    img.src = dataUrl;
    img.alt = capText;
    img.draggable = false;
    shot.appendChild(capEl);
    shot.appendChild(img);
    var actions = document.createElement('div');
    actions.className = 'margin-shot-actions';
    actions.contentEditable = 'false';
    var replaceBtn = document.createElement('button');
    replaceBtn.type = 'button';
    replaceBtn.className = 'margin-ui-btn';
    replaceBtn.textContent = 'Remplacer';
    replaceBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      requestImage(shotId);
    });
    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'margin-ui-btn';
    clearBtn.textContent = 'Retirer';
    clearBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var label = capText || 'Capture';
      var next = emptyShot(label);
      shot.replaceWith(next);
      wireShot(next);
      scheduleSerialize();
    });
    actions.appendChild(replaceBtn);
    actions.appendChild(clearBtn);
    shot.appendChild(actions);
    shot.contentEditable = 'false';
    shot.setAttribute('contenteditable', 'false');
  }

  function wireShot(shot) {
    if (!shot || shot.dataset.marginWired) return;
    shot.dataset.marginWired = '1';
    if (!shot.getAttribute('data-shot-id')) {
      shot.setAttribute('data-shot-id', 'shot-' + Math.random().toString(36).slice(2, 10));
    }
    shot.contentEditable = 'false';
    shot.setAttribute('contenteditable', 'false');
    if (shot.querySelector('img') && !shot.querySelector('.margin-shot-actions')) {
      fillShotWithImage(shot, shot.querySelector('img').getAttribute('src'));
    }
    shot.addEventListener('click', function (e) {
      if (e.target.closest('.margin-ui-btn')) return;
      e.preventDefault();
      e.stopPropagation();
      requestImage(shot.getAttribute('data-shot-id'));
    }, true);
  }

  function enhanceShotsGrids() {
    document.querySelectorAll('.shots').forEach(function (grid) {
      grid.querySelectorAll('.shot').forEach(wireShot);
      if (grid.querySelector('.margin-add-shot')) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'margin-ui-btn margin-add-shot';
      btn.textContent = '+ Emplacement capture';
      btn.contentEditable = 'false';
      btn.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); });
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var n = grid.querySelectorAll('.shot').length + 1;
        var shot = emptyShot('Capture ' + n);
        grid.insertBefore(shot, btn);
        wireShot(shot);
        scheduleSerialize();
      });
      grid.appendChild(btn);
      grid.contentEditable = 'false';
      grid.setAttribute('contenteditable', 'false');
    });
  }

  function addPeriod() {
    var template = document.querySelector('article.period.template') || document.querySelector('#periode-type');
    var page = document.querySelector('.page') || document.body;
    var num = nextPeriodNumber();
    var node;
    if (template) {
      node = template.cloneNode(true);
      node.classList.remove('template');
      node.id = 'periode-' + padNum(num);
      var numEl = node.querySelector('.period-num');
      if (numEl) numEl.textContent = padNum(num);
      var h2 = node.querySelector('.period-title h2');
      if (h2) {
        h2.childNodes.forEach(function () {});
        h2.textContent = 'Nouvelle période ';
        var stamp = document.createElement('span');
        stamp.className = 'stamp';
        stamp.textContent = 'À préparer';
        h2.appendChild(stamp);
      }
      var phase = node.querySelector('.phase');
      if (phase) phase.textContent = 'Phase · …';
      var dates = node.querySelector('.period-dates');
      if (dates) {
        dates.innerHTML = '<strong>JJ mois → JJ mois 2026</strong> Rencontre mentor n° ' + num;
      }
      node.querySelectorAll('.shot').forEach(function (s, i) {
        var fresh = emptyShot('Capture ' + String.fromCharCode(65 + i));
        s.replaceWith(fresh);
      });
      template.parentNode.insertBefore(node, template);
    } else {
      node = document.createElement('article');
      node.className = 'period';
      node.id = 'periode-' + padNum(num);
      node.innerHTML =
        '<header class="period-head">' +
        '<div class="period-num">' + padNum(num) + '</div>' +
        '<div class="period-title"><h2>Nouvelle période <span class="stamp">À préparer</span></h2>' +
        '<div class="phase">Phase · …</div></div>' +
        '<div class="period-dates"><strong>JJ mois → JJ mois 2026</strong> Rencontre mentor n° ' + num + '</div>' +
        '</header>' +
        '<section class="block"><div class="block-label"><h3>Objectif</h3></div><ul class="blank-lines"><li></li><li></li></ul></section>' +
        '<section class="block"><div class="block-label"><h3>Captures</h3></div><div class="shots"></div></section>';
      page.appendChild(node);
      var shots = node.querySelector('.shots');
      shots.appendChild(emptyShot('Capture A'));
      shots.appendChild(emptyShot('Capture B'));
    }

    ensureStamp(node);
    node.querySelectorAll('.stamp').forEach(wireStamp);
    enhanceShotsGrids();
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    scheduleSerialize();
    parent.postMessage({ type: 'margin:period-added', number: num }, '*');
  }

  function stripBlankPlaceholders() {
    document.querySelectorAll('.value.blank, .blank').forEach(function (el) {
      el.classList.remove('blank');
    });
  }

  function lockChromeFromEditing() {
    // Keep structure chrome (captures, stamps, UI buttons) out of the editable surface
    document.querySelectorAll('.shot, .shots, .stamp, .margin-ui-btn, .margin-shot-actions, .margin-add-shot').forEach(function (el) {
      el.contentEditable = 'false';
      el.setAttribute('contenteditable', 'false');
    });
  }

  function enableOwnerEditing() {
    stripBlankPlaceholders();
    document.body.classList.add('margin-editing');
    // Whole-document editing again (delete list items / blocks with Backspace or Select+Delete)
    document.body.contentEditable = 'true';
    document.body.spellcheck = true;
    lockChromeFromEditing();

    document.querySelectorAll('input, textarea, select').forEach(function (el) {
      el.addEventListener('mousedown', function (e) { e.stopPropagation(); });
      el.addEventListener('click', function (e) { e.stopPropagation(); });
      el.addEventListener('input', scheduleSerialize);
      el.addEventListener('change', scheduleSerialize);
    });

    document.body.addEventListener('input', scheduleSerialize);
    document.body.addEventListener('blur', scheduleSerialize, true);

    // After edits, re-lock chrome so new nodes don't become weirdly editable
    document.body.addEventListener('input', function () {
      lockChromeFromEditing();
    });

    document.querySelectorAll('article.period').forEach(function (period) {
      if (period.classList.contains('template')) return;
      ensureStamp(period);
    });
    document.querySelectorAll('.stamp').forEach(wireStamp);
    enhanceShotsGrids();
    lockChromeFromEditing();

    parent.postMessage({
      type: 'margin:capabilities',
      journal: !!document.querySelector('article.period'),
    }, '*');
  }

  function lockShareView() {
    stripBlankPlaceholders();
    document.body.classList.add('margin-readonly');
    document.body.contentEditable = 'false';
    document.designMode = 'off';

    document.querySelectorAll('[contenteditable]').forEach(function (el) {
      el.setAttribute('contenteditable', 'false');
      el.removeAttribute('contenteditable');
    });

    document.querySelectorAll('input, textarea, select').forEach(function (el) {
      el.setAttribute('readonly', 'readonly');
      el.setAttribute('disabled', 'disabled');
      el.tabIndex = -1;
    });

    // Block any edit attempts (paste, typing, drop) while keeping text selection for comments
    ['beforeinput', 'input', 'paste', 'drop', 'cut'].forEach(function (evt) {
      document.addEventListener(evt, function (e) {
        e.preventDefault();
        e.stopPropagation();
      }, true);
    });

    document.addEventListener('keydown', function (e) {
      var key = e.key || '';
      var meta = e.metaKey || e.ctrlKey;
      // Allow copy / select-all / find / arrows for commenting UX
      if (meta && (key === 'c' || key === 'C' || key === 'a' || key === 'A' || key === 'f' || key === 'F')) return;
      if (key === 'Escape' || key.indexOf('Arrow') === 0 || key === 'Home' || key === 'End' || key === 'PageUp' || key === 'PageDown' || key === 'Tab') return;
      if (key === 'Shift' || key === 'Meta' || key === 'Control' || key === 'Alt') return;
      e.preventDefault();
      e.stopPropagation();
    }, true);
  }

  if (MODE === 'owner') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', enableOwnerEditing);
    } else {
      enableOwnerEditing();
    }
  } else {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', lockShareView);
    } else {
      lockShareView();
    }
  }

  parent.postMessage({ type: 'margin:ready', mode: MODE }, '*');
})();
</script>`;

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${bridge}</body>`);
  }
  return `${html}${bridge}`;
}
