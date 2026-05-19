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

  return { convert, bindInput };
})();
