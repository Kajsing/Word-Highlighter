document.addEventListener('DOMContentLoaded', () => {
    const wordListTextarea = document.getElementById('wordList');
    const wordToggleContainer = document.getElementById('wordToggleContainer');
    const saveButton = document.getElementById('saveButton');

    let currentWords = [];

    // Hent gemte ord fra storage
    chrome.storage.local.get(['words'], (result) => {
        console.log('Hentede ord fra storage i popup:', result.words);
        if (result.words) {
            const words = result.words.map(w => w.word);
            wordListTextarea.value = words.join(',');
            currentWords = result.words;
            renderWordToggles(result.words);
            requestWordCounts();
        }
    });

    // Render toggle switches for hver ord med tællinger
    function renderWordToggles(words) {
        wordToggleContainer.innerHTML = '';
        words.forEach(wordObj => {
            const div = document.createElement('div');
            div.className = 'word-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = wordObj.active;
            checkbox.id = `toggle-${wordObj.word}`;

            const label = document.createElement('label');
            label.htmlFor = `toggle-${wordObj.word}`;
            label.textContent = wordObj.word;

            const countSpan = document.createElement('span');
            countSpan.className = 'word-count';
            countSpan.id = `count-${wordObj.word}`;
            countSpan.textContent = ''; // Placeholder for counts

            div.appendChild(checkbox);
            div.appendChild(label);
            div.appendChild(countSpan);
            wordToggleContainer.appendChild(div);
        });
    }

    // Gem funktionalitet
    saveButton.addEventListener('click', () => {
        const wordsInput = wordListTextarea.value.split(',').map(w => w.trim()).filter(w => w);
        console.log('Ord indtastet af bruger:', wordsInput);

        // Hent eksisterende words for at bevare deres aktive tilstand
        chrome.storage.local.get(['words'], (result) => {
            console.log('Eksisterende ord ved gem:', result.words);
            let existingWords = result.words || [];
            // Opret et map for hurtigere søgning
            const existingMap = {};
            existingWords.forEach(w => {
                existingMap[w.word.toLowerCase()] = w.active;
            });

            // Opdater ordlisten med nye ord og bevare eksisterende aktive tilstande
            const updatedWords = wordsInput.map(word => {
                const lowerWord = word.toLowerCase();
                return {
                    word: word,
                    active: existingMap[lowerWord] !== undefined ? existingMap[lowerWord] : true
                };
            });

            console.log('Opdaterede ord til gemning:', updatedWords);

            chrome.storage.local.set({ words: updatedWords }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Fejl under gemning:', chrome.runtime.lastError);
                } else {
                    console.log('Ordlisten er gemt:', updatedWords);
                    // Send besked til content script om at opdatere highlights
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs[0].id) {
                            chrome.tabs.sendMessage(tabs[0].id, { action: 'updateWords', words: updatedWords }, (response) => {
                                if (chrome.runtime.lastError) {
                                    console.error('Fejl under sending af besked:', chrome.runtime.lastError);
                                } else {
                                    console.log('Besked sendt til content script.');
                                    currentWords = updatedWords;
                                    renderWordToggles(updatedWords);
                                    requestWordCounts();
                                }
                            });
                        }
                    });
                }
            });
        });
    });

    // Lytter til ændringer i toggles
    wordToggleContainer.addEventListener('change', (event) => {
        if (event.target && event.target.type === 'checkbox') {
            const word = event.target.id.replace('toggle-', '');
            const isActive = event.target.checked;
            console.log(`Toggle ændret for ord: ${word}, active: ${isActive}`);

            chrome.storage.local.get(['words'], (result) => {
                if (result.words) {
                    const updatedWords = result.words.map(w => {
                        if (w.word.toLowerCase() === word.toLowerCase()) { // Brug lowercase for konsistens
                            return { ...w, active: isActive };
                        }
                        return w;
                    });

                    console.log(`Opdaterede ord efter toggle:`, updatedWords);

                    chrome.storage.local.set({ words: updatedWords }, () => {
                        if (chrome.runtime.lastError) {
                            console.error('Fejl under opdatering af ord:', chrome.runtime.lastError);
                        } else {
                            console.log(`Ord "${word}" opdateret til active: ${isActive}`);
                            // Send besked til content script om at opdatere highlights
                            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                                if (tabs[0].id) {
                                    chrome.tabs.sendMessage(tabs[0].id, { action: 'updateWords', words: updatedWords }, (response) => {
                                        if (chrome.runtime.lastError) {
                                            console.error('Fejl under sending af besked:', chrome.runtime.lastError);
                                        } else {
                                            console.log('Besked sendt til content script.');
                                            currentWords = updatedWords;
                                            renderWordToggles(updatedWords);
                                            requestWordCounts();
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });

    // Anmod om word counts fra content script
    function requestWordCounts() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'getWordCounts' }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Fejl under anmodning om word counts:', chrome.runtime.lastError);
                    } else if (response && response.counts) {
                        console.log('Modtaget word counts:', response.counts);
                        displayWordCounts(response.counts);
                    }
                });
            }
        });
    }

    // Vis word counts i popup'en
    function displayWordCounts(counts) {
        currentWords.forEach(wordObj => {
            const wordLower = wordObj.word.toLowerCase();
            const count = counts[wordLower] || 0;
            const countSpan = document.getElementById(`count-${wordObj.word}`);
            if (countSpan) {
                countSpan.textContent = `(${count})`;
            }
        });
    }
});
