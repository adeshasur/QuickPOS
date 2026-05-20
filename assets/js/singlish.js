window.Singlish = (function () {
  'use strict';

  const phraseMap = new Map([
    ['keeri samba', 'කීරි සම්බා'],
    ['samba', 'සම්බා'],
    ['nadu', 'නාඩු'],
    ['sahal', 'සහල්'],
    ['haal', 'හාල්'],
    ['parippu', 'පරිප්පු'],
    ['kiri', 'කිරි'],
    ['elavalu', 'එළවලු'],
    ['miris', 'මිරිස්'],
    ['lunu', 'ලුණු'],
    ['sini', 'සීනි'],
    ['cream cracker', 'ක්‍රීම් ක්‍රැකර්'],
    ['supiri', 'සුපිරි']
  ]);

  const productWordMap = new Map([
    ['keeri', 'කීරි'],
    ['samba', 'සම්බා'],
    ['nadu', 'නාඩු'],
    ['rice', 'සහල්'],
    ['sahal', 'සහල්'],
    ['haal', 'හාල්'],
    ['white', 'සුදු'],
    ['red', 'රතු'],
    ['raw', 'කච්චි'],
    ['parippu', 'පරිප්පු'],
    ['dhal', 'පරිප්පු'],
    ['sugar', 'සීනි'],
    ['sini', 'සීනි'],
    ['salt', 'ලුණු'],
    ['lunu', 'ලුණු'],
    ['milk', 'කිරි'],
    ['kiri', 'කිරි'],
    ['powder', 'පවුඩර්'],
    ['tea', 'තේ'],
    ['flour', 'පිටි'],
    ['wheat', 'තිරිඟු'],
    ['soap', 'සබන්'],
    ['shampoo', 'ෂැම්පු'],
    ['biscuit', 'බිස්කට්'],
    ['cracker', 'ක්‍රැකර්'],
    ['cream', 'ක්‍රීම්'],
    ['noodles', 'නූඩ්ල්ස්'],
    ['oil', 'තෙල්'],
    ['coconut', 'පොල්'],
    ['chilli', 'මිරිස්'],
    ['miris', 'මිරිස්'],
    ['turmeric', 'කහ'],
    ['pepper', 'ගම්මිරිස්'],
    ['kg', 'kg'],
    ['g', 'g'],
    ['l', 'L'],
    ['ml', 'ml']
  ]);
  const candidateLexicon = Array.from(new Set([
    ...Array.from(phraseMap.keys()),
    ...Array.from(productWordMap.keys())
  ]));

  const vowels = [
    { en: 'aee', si: 'ඈ', pilla: 'ෑ' },
    { en: 'ae', si: 'ඇ', pilla: 'ැ' },
    { en: 'aa', si: 'ආ', pilla: 'ා' },
    { en: 'ii', si: 'ඊ', pilla: 'ී' },
    { en: 'ee', si: 'ඒ', pilla: 'ේ' },
    { en: 'ei', si: 'ඓ', pilla: 'ෛ' },
    { en: 'ai', si: 'ඓ', pilla: 'ෛ' },
    { en: 'oo', si: 'ඕ', pilla: 'ෝ' },
    { en: 'ou', si: 'ඖ', pilla: 'ෞ' },
    { en: 'au', si: 'ඖ', pilla: 'ෞ' },
    { en: 'uu', si: 'ඌ', pilla: 'ූ' },
    { en: 'a', si: 'අ', pilla: '' },
    { en: 'i', si: 'ඉ', pilla: 'ි' },
    { en: 'u', si: 'උ', pilla: 'ු' },
    { en: 'e', si: 'එ', pilla: 'ෙ' },
    { en: 'o', si: 'ඔ', pilla: 'ො' }
  ];

  const consonants = [
    { en: 'nnd', si: 'ඬ' },
    { en: 'nng', si: 'ඟ' },
    { en: 'mmb', si: 'ඹ' },
    { en: 'kh', si: 'ඛ' },
    { en: 'gh', si: 'ඝ' },
    { en: 'ch', si: 'ච' },
    { en: 'jh', si: 'ඣ' },
    { en: 'th', si: 'ථ' },
    { en: 'dh', si: 'ධ' },
    { en: 'ph', si: 'ඵ' },
    { en: 'bh', si: 'භ' },
    { en: 'sh', si: 'ශ' },
    { en: 'gn', si: 'ඥ' },
    { en: 'kn', si: 'ඤ' },
    { en: 'nd', si: 'ඳ' },
    { en: 'ng', si: 'ඞ' },
    { en: 'k', si: 'ක' },
    { en: 'g', si: 'ග' },
    { en: 't', si: 'ට' },
    { en: 'd', si: 'ඩ' },
    { en: 'n', si: 'න' },
    { en: 'p', si: 'ප' },
    { en: 'b', si: 'බ' },
    { en: 'm', si: 'ම' },
    { en: 'y', si: 'ය' },
    { en: 'r', si: 'ර' },
    { en: 'l', si: 'ල' },
    { en: 'v', si: 'ව' },
    { en: 'w', si: 'ව' },
    { en: 's', si: 'ස' },
    { en: 'h', si: 'හ' },
    { en: 'c', si: 'ක' },
    { en: 'j', si: 'ජ' },
    { en: 'f', si: 'ෆ' }
  ];

  function convertWord(word) {
    if (!word || /[\u0D80-\u0DFF]/.test(word)) return word;
    if (!/[a-z]/i.test(word)) return word;

    let out = String(word).toLowerCase();
    out = out.replace(/ruu/g, 'රූ').replace(/ru/g, 'රු');

    for (const c of consonants) {
      for (const v of vowels) {
        out = out.replaceAll(c.en + v.en, c.si + v.pilla);
      }
    }

    for (const c of consonants) {
      out = out.replaceAll(c.en, c.si + '්');
    }

    for (const v of vowels) {
      out = out.replaceAll(v.en, v.si);
    }

    return out;
  }

  function convert(text) {
    if (!text) return '';

    let source = String(text);
    let lower = source.toLowerCase();

    for (const [roman, sinhala] of phraseMap.entries()) {
      lower = lower.replaceAll(roman, sinhala);
    }

    const tokens = lower.split(/(\s+|[0-9./\-]+)/g);
    return tokens.map(convertWord).join('');
  }

  function convertProductName(text) {
    if (!text) return '';
    const source = String(text);
    if (/[\u0D80-\u0DFF]/.test(source)) return source;

    let lower = source.toLowerCase();
    for (const [roman, sinhala] of phraseMap.entries()) {
      lower = lower.replaceAll(roman, sinhala);
    }

    const tokens = lower.split(/(\s+|[0-9./\-]+)/g).map((token) => {
      const key = token.trim();
      if (!key) return token;
      if (/[\u0D80-\u0DFF]/.test(key)) return token;
      if (productWordMap.has(key)) return productWordMap.get(key);
      if (!/[a-z]/i.test(key)) return token;
      return token; // Unknown words stay English to avoid wrong Sinhala spelling
    });

    return tokens.join('');
  }

  function bindInput(inputEl, isEnabled) {
    if (!inputEl) return;
    const enabledFn = typeof isEnabled === 'function' ? isEnabled : () => true;

    inputEl.addEventListener('input', () => {
      if (!enabledFn()) return;

      const before = inputEl.value;
      const selectionStart = inputEl.selectionStart || before.length;
      const converted = convert(before);
      if (converted === before) return;

      inputEl.value = converted;
      const nextPos = Math.min(converted.length, selectionStart + (converted.length - before.length));
      inputEl.setSelectionRange(nextPos, nextPos);
    });
  }

  function buildCandidates(token) {
    const key = normalizeToken(token);
    if (!key || key.length < 2) return [];
    const direct = productWordMap.get(key);

    const scored = candidateLexicon
      .filter((entry) => entry.startsWith(key))
      .slice(0, 8)
      .map((entry) => ({
        roman: entry,
        sinhala: productWordMap.get(entry) || phraseMap.get(entry) || convert(entry)
      }));

    if (direct && !scored.some((row) => row.roman === key)) {
      scored.unshift({ roman: key, sinhala: direct });
    }

    // Always provide a generic phonetic candidate for unknown words.
    // This keeps IME behavior active even when the word is not in dictionary.
    if (!scored.length) {
      const fallback = convert(key);
      if (fallback && fallback !== key) {
        scored.unshift({ roman: key, sinhala: fallback });
      }
    }

    return scored.slice(0, 8);
  }

  function normalizeToken(token) {
    return String(token || '').toLowerCase().trim();
  }

  function bindImeInput(inputEl, isEnabled) {
    if (!inputEl) return;
    const enabledFn = typeof isEnabled === 'function' ? isEnabled : () => true;

    const dropdown = document.createElement('div');
    dropdown.style.position = 'fixed';
    dropdown.style.zIndex = '2200';
    dropdown.style.minWidth = '240px';
    dropdown.style.maxWidth = '360px';
    dropdown.style.maxHeight = '220px';
    dropdown.style.overflowY = 'auto';
    dropdown.style.background = '#ffffff';
    dropdown.style.border = '1px solid #cbd5e1';
    dropdown.style.borderRadius = '10px';
    dropdown.style.boxShadow = '0 14px 30px rgba(15,23,42,0.14)';
    dropdown.style.padding = '6px';
    dropdown.style.display = 'none';
    document.body.appendChild(dropdown);

    let activeIndex = 0;
    let candidates = [];

    function hide() {
      dropdown.style.display = 'none';
      candidates = [];
      activeIndex = 0;
    }

    function getCurrentToken() {
      const cursor = inputEl.selectionStart || 0;
      const left = inputEl.value.slice(0, cursor);
      const match = left.match(/([A-Za-z]+)$/);
      return match ? match[1] : '';
    }

    function replaceToken(value) {
      const cursor = inputEl.selectionStart || 0;
      const left = inputEl.value.slice(0, cursor);
      const right = inputEl.value.slice(cursor);
      const nextLeft = left.replace(/([A-Za-z]+)$/, value);
      inputEl.value = `${nextLeft}${right}`;
      const nextPos = nextLeft.length;
      inputEl.setSelectionRange(nextPos, nextPos);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function render() {
      const rect = inputEl.getBoundingClientRect();
      dropdown.style.left = `${rect.left}px`;
      dropdown.style.top = `${rect.bottom + 6}px`;
      dropdown.style.width = `${Math.max(rect.width, 240)}px`;
      dropdown.innerHTML = candidates.map((row, idx) => `
        <button type="button" data-idx="${idx}" style="
          width:100%;text-align:left;border:none;border-radius:8px;padding:8px 10px;
          background:${idx === activeIndex ? '#e0e7ff' : 'transparent'};cursor:pointer;
          display:flex;justify-content:space-between;gap:10px;align-items:center;">
          <span style="font-size:13px;font-weight:700;color:#0f172a;font-family:'Noto Sans Sinhala','Iskoola Pota',sans-serif;">${row.sinhala}</span>
          <span style="font-size:11px;color:#64748b;">${row.roman}</span>
        </button>
      `).join('');
      dropdown.style.display = candidates.length ? 'block' : 'none';

      dropdown.querySelectorAll('button[data-idx]').forEach((btn) => {
        btn.addEventListener('mousedown', (event) => {
          event.preventDefault();
          const row = candidates[Number(btn.dataset.idx)];
          if (!row) return;
          replaceToken(row.sinhala);
          hide();
          inputEl.focus();
        });
      });
    }

    inputEl.addEventListener('input', () => {
      if (!enabledFn()) {
        hide();
        return;
      }
      const token = getCurrentToken();
      candidates = buildCandidates(token);
      activeIndex = 0;
      render();
    });

    inputEl.addEventListener('keydown', (event) => {
      if (!enabledFn()) return;

      const commitTokenWithFallback = (appendSpace) => {
        const token = getCurrentToken();
        if (!token) return false;
        const row = candidates[activeIndex];
        const picked = row ? row.sinhala : convert(token);
        if (!picked || picked === token) return false;
        replaceToken(appendSpace ? `${picked} ` : picked);
        hide();
        return true;
      };

      if (event.key === 'Enter' || event.key === 'Tab') {
        if (commitTokenWithFallback(false)) {
          event.preventDefault();
          return;
        }
      }

      if (event.key === ' ') {
        if (commitTokenWithFallback(true)) {
          event.preventDefault();
          return;
        }
      }

      if (!candidates.length) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        activeIndex = (activeIndex + 1) % candidates.length;
        render();
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        activeIndex = (activeIndex - 1 + candidates.length) % candidates.length;
        render();
        return;
      }
      if (event.key === 'Escape') {
        hide();
      }
    });

    inputEl.addEventListener('blur', () => {
      setTimeout(hide, 120);
    });

    window.addEventListener('resize', hide);
    window.addEventListener('scroll', hide, true);
  }

  return { convert, convertProductName, bindInput, bindImeInput };
})();
