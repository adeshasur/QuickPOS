window.Singlish = (function() {
    const vowels = [
        {"en": "aee", "si": "ඈ", "pilla": "ෑ"},
        {"en": "ae", "si": "ඇ", "pilla": "ැ"},
        {"en": "aa", "si": "ආ", "pilla": "ා"},
        {"en": "A", "si": "ආ", "pilla": "ා"},
        {"en": "ii", "si": "ඊ", "pilla": "ී"},
        {"en": "I", "si": "ඊ", "pilla": "ී"},
        {"en": "ee", "si": "ඒ", "pilla": "ේ"},
        {"en": "E", "si": "ඒ", "pilla": "ේ"},
        {"en": "ei", "si": "ඓ", "pilla": "ෛ"},
        {"en": "oo", "si": "ඕ", "pilla": "ෝ"},
        {"en": "O", "si": "ඕ", "pilla": "ෝ"},
        {"en": "ou", "si": "ඖ", "pilla": "ෞ"},
        {"en": "uu", "si": "ඌ", "pilla": "ූ"},
        {"en": "U", "si": "ඌ", "pilla": "ූ"},
        {"en": "a", "si": "අ", "pilla": ""},
        {"en": "i", "si": "ඉ", "pilla": "ි"},
        {"en": "u", "si": "උ", "pilla": "ු"},
        {"en": "e", "si": "එ", "pilla": "ෙ"},
        {"en": "o", "si": "ඔ", "pilla": "ො"}
    ];

    const consonants = [
        {"en": "nnd", "si": "ඬ"},
        {"en": "nng", "si": "ඟ"},
        {"en": "mmb", "si": "ඹ"},
        {"en": "kh", "si": "ඛ"},
        {"en": "gh", "si": "ඝ"},
        {"en": "ch", "si": "ච"},
        {"en": "jh", "si": "ඣ"},
        {"en": "Th", "si": "ඨ"},
        {"en": "Dh", "si": "ඪ"},
        {"en": "th", "si": "ථ"},
        {"en": "dh", "si": "ධ"},
        {"en": "ph", "si": "ඵ"},
        {"en": "bh", "si": "භ"},
        {"en": "sh", "si": "ශ"},
        {"en": "Sh", "si": "ෂ"},
        {"en": "gn", "si": "ඥ"},
        {"en": "kn", "si": "ඤ"},
        {"en": "nd", "si": "ඳ"},
        {"en": "k", "si": "ක"},
        {"en": "g", "si": "ග"},
        {"en": "t", "si": "ත"},
        {"en": "T", "si": "ට"},
        {"en": "d", "si": "ද"},
        {"en": "D", "si": "ඩ"},
        {"en": "n", "si": "න"},
        {"en": "N", "si": "ණ"},
        {"en": "p", "si": "ප"},
        {"en": "b", "si": "බ"},
        {"en": "m", "si": "ම"},
        {"en": "y", "si": "ය"},
        {"en": "r", "si": "ර"},
        {"en": "l", "si": "ල"},
        {"en": "L", "si": "ළ"},
        {"en": "v", "si": "ව"},
        {"en": "w", "si": "ව"},
        {"en": "s", "si": "ස"},
        {"en": "h", "si": "හ"},
        {"en": "c", "si": "ක"},
        {"en": "j", "si": "ජ"},
        {"en": "f", "si": "ෆ"}
    ];

    // Special consonant combinations (like yansaya, rakaransaya)
    const specialCombinations = [
        {"en": "ry", "si": "ර්ය"}, // rya
    ];

    function convert(text) {
        let out = text;

        // 1. Special cases (e.g., ru, ruu)
        out = out.replace(/ruu/g, 'රූ').replace(/ru/g, 'රු');

        // 2. Map Consonants + Vowels
        for (let c of consonants) {
            for (let v of vowels) {
                let pattern = new RegExp(c.en + v.en, "g");
                out = out.replace(pattern, c.si + v.pilla);
            }
        }

        // 3. Map remaining Consonants (gets hal kirima '්')
        for (let c of consonants) {
            let pattern = new RegExp(c.en, "g");
            out = out.replace(pattern, c.si + '්');
        }

        // 4. Map standalone Vowels
        for (let v of vowels) {
            let pattern = new RegExp(v.en, "g");
            out = out.replace(pattern, v.si);
        }

        return out;
    }

    /**
     * Bind phonetic typing to an input field
     * @param {HTMLInputElement} inputEl The input element to bind to
     * @param {Function} isEnabled Callback that returns true if phonetic typing is currently enabled
     */
    function bindInput(inputEl, isEnabled) {
        if (!inputEl) return;
        
        let lastValue = inputEl.value;

        inputEl.addEventListener('input', function(e) {
            if (!isEnabled()) {
                lastValue = inputEl.value;
                return;
            }

            // We only convert the newly added characters based on the cursor position
            // But since full text conversion is fast and easy, let's do a trick:
            // Find words separated by space, convert the last typing word.
            // A more robust real-time editor approach:
            
            let cursor = inputEl.selectionStart;
            let val = inputEl.value;
            
            // If text was deleted, just update lastValue and return
            if (val.length < lastValue.length) {
                lastValue = val;
                return;
            }

            // Split into words
            let words = val.split(' ');
            let outWords = [];
            
            for (let word of words) {
                // If it contains English letters, we try to convert
                if (/[a-zA-Z]/.test(word)) {
                    outWords.push(convert(word));
                } else {
                    outWords.push(word);
                }
            }
            
            let result = outWords.join(' ');
            
            // Adjust cursor position roughly (this is a simple implementation)
            if (result !== val) {
                inputEl.value = result;
                // Keep cursor at end for simple typing
                inputEl.setSelectionRange(result.length, result.length);
            }
            
            lastValue = inputEl.value;
        });
    }

    return { convert, bindInput };
})();
