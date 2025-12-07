import { Solitaire } from './logic/Solitaire.js';

const game = new Solitaire();
const app = document.getElementById('app');

// DOM Elements
const stockEl = document.getElementById('stock');
const wasteEl = document.getElementById('waste');
const foundationEls = Array.from(document.querySelectorAll('.foundation'));
const tableauEls = Array.from(document.querySelectorAll('.tableau-pile'));

// State for drag and drop
let draggedCard = null;
let sourcePile = null; // { type: 'tableau'|'waste'|'foundation', index: int|string }

function init() {
    game.startNewGame();
    render();
    setupEventListeners();
}

function createCardElement(card) {
    const el = document.createElement('div');
    el.classList.add('card');
    el.id = card.id;

    if (!card.faceUp) {
        el.classList.add('face-down');
        el.classList.add(`deck-${card.deckNumber}`); // Add deck-specific class
    } else {
        el.classList.add(card.color);
        el.draggable = true;

        // Top Left Corner
        const tl = document.createElement('div');
        tl.classList.add('corner', 'top-left');
        tl.innerHTML = `<div>${card.suitSymbol}</div><div>${card.rankString}</div>`;
        el.appendChild(tl);

        // Bottom Right Corner
        const br = document.createElement('div');
        br.classList.add('corner', 'bottom-right');
        br.innerHTML = `<div>${card.suitSymbol}</div><div>${card.rankString}</div>`;
        el.appendChild(br);

        // Center Symbol (Optional, but looks nice)
        const center = document.createElement('div');
        center.classList.add('center-symbol');
        center.textContent = card.suitSymbol;
        el.appendChild(center);
    }

    // Data attributes for logic
    el.dataset.id = card.id;

    return el;
}

function render() {
    // Render Stock
    stockEl.innerHTML = '';
    if (game.stock.length > 0) {
        const card = document.createElement('div');
        card.classList.add('card', 'face-down');
        stockEl.appendChild(card);
    } else if (game.stock.length === 0 && game.waste.length > 0) {
        // Show empty stock placeholder that can be clicked to recycle
        const empty = document.createElement('div');
        empty.classList.add('card-placeholder'); // Add style for this
        stockEl.appendChild(empty);
    }

    // Render Waste
    wasteEl.innerHTML = '';
    if (game.waste.length > 0) {
        // Show top 3 cards or just top 1? Standard is top 1 visible fully, maybe fanned
        // For simplicity, just top 1 for now
        const topCard = game.waste[game.waste.length - 1];
        wasteEl.appendChild(createCardElement(topCard));
    }

    // Render Foundations
    foundationEls.forEach(el => {
        const suit = el.dataset.suit;
        const slotIndex = parseInt(el.dataset.index);
        const pile = game.foundations[suit][slotIndex];
        el.innerHTML = '';
        if (pile.length > 0) {
            const topCard = pile[pile.length - 1];
            el.appendChild(createCardElement(topCard));
        }
    });

    // Render Tableau
    game.tableau.forEach((pile, index) => {
        const el = tableauEls[index];
        el.innerHTML = '';
        pile.forEach((card, cardIndex) => {
            const cardEl = createCardElement(card);
            // Stack vertically
            cardEl.style.top = `${cardIndex * 30}px`; // 30px offset
            el.appendChild(cardEl);
        });
    });
}

function setupEventListeners() {
    // Stock Click
    stockEl.addEventListener('click', () => {
        game.drawFromStock();
        render();
    });

    // Drag Start (Delegated)
    document.addEventListener('dragstart', (e) => {
        if (!e.target.classList.contains('card')) return;
        if (e.target.classList.contains('face-down')) {
            e.preventDefault();
            return;
        }

        const cardId = e.target.dataset.id;
        const location = game.findCard(cardId);

        if (!location) {
            return;
        }

        draggedCard = location.card;
        sourcePile = { type: location.type, index: location.index };

        e.dataTransfer.setData('text/plain', cardId);
        e.dataTransfer.effectAllowed = 'move';

        // Custom Drag Image for Stacks
        if (location.type === 'tableau') {
            const pile = game.tableau[location.index];
            const cardIndex = pile.indexOf(location.card);

            // If dragging a stack (more than 1 card)
            if (cardIndex < pile.length - 1) {
                const container = document.createElement('div');
                container.id = 'drag-image-container';
                container.style.position = 'absolute';
                container.style.top = '-1000px';
                container.style.left = '-1000px';
                container.style.width = 'var(--card-width)'; // Ensure width matches
                document.body.appendChild(container);

                // Clone cards from the dragged one to the top
                for (let i = cardIndex; i < pile.length; i++) {
                    const card = pile[i];
                    const originalEl = document.getElementById(card.id);
                    if (originalEl) {
                        const clone = originalEl.cloneNode(true);
                        clone.style.position = 'absolute';
                        clone.style.top = `${(i - cardIndex) * 30}px`; // Maintain 30px offset
                        clone.style.left = '0';
                        clone.classList.remove('dragging'); // Ensure clone doesn't look like it's being dragged
                        container.appendChild(clone);
                    }
                }

                // Set drag image
                // Offset: center of the first card (approx) or where user clicked
                // e.offsetX/Y gives pos within the element.
                e.dataTransfer.setDragImage(container, e.offsetX, e.offsetY);

                // Cleanup after a short delay
                setTimeout(() => {
                    document.body.removeChild(container);
                }, 0);
            }
        }

        // Visual drag effect for the original element(s)
        // We might want to hide the whole stack in the tableau, but for now just the dragged card
        setTimeout(() => e.target.classList.add('dragging'), 0);
    });

    document.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('card')) {
            e.target.classList.remove('dragging');
        }
        draggedCard = null;
        sourcePile = null;
    });

    // Drop Zones
    // Tableau
    tableauEls.forEach((el, index) => {
        el.addEventListener('dragover', (e) => {
            e.preventDefault(); // Allow drop
            e.dataTransfer.dropEffect = 'move';
        });

        el.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!draggedCard) return;

            // Try to move
            // We need to handle moving stacks. 
            // If dragging from tableau, we might be dragging a stack.
            // The current simple logic in Solitaire.js handles single cards mostly, 
            // but let's see if we can move the single card first.

            // If source is tableau and we are dragging a card that is NOT the top one, 
            // we are dragging a stack.
            // For now, let's just support moving the top card or the whole valid stack.

            // Check if valid move
            // We need to implement stack move logic in Solitaire.js properly
            // For now, let's try the single card move function

            if (game.moveCardToTableau(draggedCard, sourcePile.type, sourcePile.index, index)) {
                render();
            }
        });
    });

    // Foundations
    foundationEls.forEach(el => {
        el.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        el.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!draggedCard) return;

            const suit = el.dataset.suit;
            const slotIndex = parseInt(el.dataset.index);

            // Only allow cards of matching suit
            if (draggedCard.suit !== suit) return;

            if (game.moveCardToFoundation(draggedCard, sourcePile.type, sourcePile.index, slotIndex)) {
                render();
            }
        });
    });

    // Double Click to Auto Move
    app.addEventListener('dblclick', (e) => {
        const cardEl = e.target.closest('.card');
        if (!cardEl) return;

        // Ignore face down cards
        if (cardEl.classList.contains('face-down')) return;

        const cardId = cardEl.dataset.id;
        const location = game.findCard(cardId);

        if (location && location.card) {
            if (game.autoMoveToFoundation(location.card)) {
                render();
            }
        }
    });

    // Single Click to Flip Face-Down Cards
    app.addEventListener('click', (e) => {
        const cardEl = e.target.closest('.card');
        if (!cardEl) return;

        // Only handle face-down cards
        if (!cardEl.classList.contains('face-down')) return;

        // Find which tableau pile this card is in
        const tableauEl = cardEl.closest('.tableau-pile');
        if (!tableauEl) return;

        const tableauIndex = tableauEls.indexOf(tableauEl);
        if (tableauIndex === -1) return;

        // Flip the top card of this pile
        if (game.flipTopCard(tableauIndex)) {
            render();
        }
    });
}

init();
