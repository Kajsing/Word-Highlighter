// Funktion til at generere en konsistent farve baseret på ordet
function getColor(word) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
        hash = word.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = `hsl(${hash % 360}, 70%, 80%)`;
    return color;
}

// Funktion til at escape specialtegn i regex
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let words = [];
let wordCounts = {};

// Hent ord fra storage ved indlæsning
chrome.storage.local.get(['words'], (result) => {
    console.log('Hentede ord fra storage i content script:', result.words);
    if (result.words) {
        words = result.words.filter(w => w.active).map(w => w.word);
        highlightWords();
    }
});

// Lytter til beskeder fra popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateWords') {
        console.log('Modtaget updateWords besked i content script:', request.words);
        words = request.words.filter(w => w.active).map(w => w.word);
        highlightWords();
    } else if (request.action === 'getWordCounts') {
        console.log('Modtaget getWordCounts besked i content script:', wordCounts);
        sendResponse({ counts: wordCounts });
    }
});

// Funktion til at highlighte ordene og tælle forekomster
function highlightWords() {
    console.log('Highlighting ord:', words);
    removeHighlights();
    wordCounts = {}; // Reset counts

    if (words.length === 0) {
        console.log('Ingen ord at highlighte.');
        return;
    }

    const regex = new RegExp(`\\b(${words.map(w => escapeRegExp(w)).join('|')})\\b`, 'gi');
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);

    const nodes = [];
    while (walker.nextNode()) {
        nodes.push(walker.currentNode);
    }

    nodes.forEach(node => {
        if (node.parentElement && !['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(node.parentElement.tagName)) {
            const matches = node.nodeValue.match(regex);
            if (matches) {
                matches.forEach(match => {
                    const lowerMatch = match.toLowerCase();
                    wordCounts[lowerMatch] = (wordCounts[lowerMatch] || 0) + 1;
                });

                const span = document.createElement('span');
                span.innerHTML = node.nodeValue.replace(regex, (match) => {
                    const lowerMatch = match.toLowerCase();
                    const color = getColor(lowerMatch);
                    return `<span class="highlighted-word" style="background-color: ${color};">${match}</span>`;
                });
                node.parentNode.replaceChild(span, node);
            }
        }
    });

    console.log('Word counts:', wordCounts);
}

// Funktion til at fjerne tidligere highlights
function removeHighlights() {
    const spans = document.querySelectorAll('span.highlighted-word');
    spans.forEach(span => {
        const parent = span.parentNode;
        parent.replaceChild(document.createTextNode(span.textContent), span);
        parent.normalize();
    });
}
