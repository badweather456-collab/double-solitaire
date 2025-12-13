import { Solitaire } from './logic/Solitaire.js?v=24';

const game = new Solitaire();
const app = document.getElementById('app');

// DOM Elements
const stockEl = document.getElementById('stock');
const stockCountEl = document.getElementById('stock-count');
const undoBtn = document.getElementById('undo-btn');
const foundationEls = Array.from(document.querySelectorAll('.foundation'));
const tableauEls = Array.from(document.querySelectorAll('.tableau-pile'));

// State for drag and drop
let draggedCard = null;
let sourcePile = null; // { type: 'tableau'|'foundation', index: int|string }

function init() {
    game.startNewGame();
    render();
    setupEventListeners();
    setupTouchEvents();
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
        tl.innerHTML = `<div>${card.suitSymbol}</div><div>${card.rankString}</div>`; // Swapped order to standard
        el.appendChild(tl);

        // Bottom Right Corner
        const br = document.createElement('div');
        br.classList.add('corner', 'bottom-right');
        br.innerHTML = `<div>${card.suitSymbol}</div><div>${card.rankString}</div>`;
        el.appendChild(br);

        // Center Symbol (Restored)
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
    // Update Stock Count
    if (stockCountEl) {
        stockCountEl.textContent = game.stock.length;
    }

    if (undoBtn) {
        undoBtn.disabled = game.undoStack.length === 0;
    }

    // Render Stock
    stockEl.innerHTML = '';
    if (game.stock.length > 0) {
        const card = document.createElement('div');
        card.classList.add('card', 'face-down');
        stockEl.appendChild(card);
    } else {
        // Show empty stock placeholder
        const empty = document.createElement('div');
        empty.classList.add('card-placeholder');
        stockEl.appendChild(empty);
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

    // Check Game Over State
    const gameState = game.checkGameState();
    if (gameState.gameOver) {
        setTimeout(() => {
            const messageEl = document.getElementById('game-message');
            messageEl.classList.remove('hidden');

            if (gameState.loopDetected) {
                messageEl.textContent = 'Game Over';
            } else {
                messageEl.textContent = 'Game Over: No more moves possible!';
            }
        }, 500);
    }
}

function setupEventListeners() {
    // Stock Click
    stockEl.addEventListener('click', () => {
        // If animation is already playing, ignore click (simple debounce)
        if (document.querySelector('.flying-card')) return;

        // Capture count BEFORE dealing for animation purposes
        let currentVisualStockCount = game.stock.length;

        const moves = game.drawFromStock();

        if (!moves || moves.length === 0) {
            render();
            return;
        }

        // Animate moves sequentially
        const stockRect = stockEl.getBoundingClientRect();

        moves.forEach((move, index) => {
            // Delay start of each card by index * 250ms (0.25 seconds)
            setTimeout(() => {
                const tempCard = createCardElement(move.card);
                tempCard.classList.add('flying-card');

                // Decrement visual count as card flies
                if (currentVisualStockCount > 0) {
                    currentVisualStockCount--;
                    stockCountEl.textContent = currentVisualStockCount;
                }

                // Start at stock position
                tempCard.style.position = 'fixed';
                tempCard.style.left = `${stockRect.left}px`;
                tempCard.style.top = `${stockRect.top}px`;
                // Higher z-index for later cards so they are on top if they overlap
                tempCard.style.zIndex = 1000 + index;
                tempCard.style.transition = 'all 0.1s ease-in-out'; // 0.1 seconds animation

                document.body.appendChild(tempCard);

                // Trigger reflow
                tempCard.getBoundingClientRect();

                // Calculate target position
                const targetPileEl = tableauEls[move.targetIndex];
                const targetRect = targetPileEl.getBoundingClientRect();

                // Calculate offset.
                const pile = game.tableau[move.targetIndex];
                const cardIndexInPile = pile.findIndex(c => c.id === move.card.id);
                // 30px offset per card in pile + 2px border offset
                const offset = cardIndexInPile * 30;

                // Move to target
                setTimeout(() => {
                    // Add 2px to account for the border of the pile
                    tempCard.style.left = `${targetRect.left + 2}px`;
                    tempCard.style.top = `${targetRect.top + offset + 2}px`;
                }, 50); // Small delay to ensuring rendering start

                // Cleanup after animation: LAND the card
                setTimeout(() => {
                    // "Land" the card: Switch to absolute positioning inside the target pile
                    tempCard.classList.remove('flying-card');
                    tempCard.style.position = 'absolute';
                    // Reset coordinates to be relative to the pile
                    // offset is calculated based on index, which matches the visual stack
                    tempCard.style.top = `${offset}px`;
                    tempCard.style.left = '0px';
                    tempCard.style.transition = 'none'; // Remove transition to prevent jump
                    tempCard.style.zIndex = 'auto'; // Let DOM order handle it, or keep index if needed

                    targetPileEl.appendChild(tempCard);

                    // Optional: If this was the last move, maybe check stock empty state?
                    // But manual DOM update is sufficient for continuity.
                }, 100); // Match transition timeplicity: just let them pile up visually, then clean all at end.
                // OR: Cleanup individual card after 2s and show it in the pile?
                // Let's stick to the "Clean all at end" pattern for simplicity unless it looks weird.
                // Wait, if we clean all at end, the first card will sit there for a long time.
                // It might be better to let them stay as 'flying-card' at destination until the very end.

            }, index * 200); // 0.2 second interval (faster dealing)
        });

        // After ALL animations complete, clean up and render
        // Total time = (moves.length - 1) * 2000 (start of last card) + 2000 (flight of last card)
        const totalDuration = (moves.length) * 200;

        setTimeout(() => {
            document.querySelectorAll('.flying-card').forEach(el => el.remove());
            render();
        }, totalDuration + 100); // buffer
    });

    // Undo Click
    undoBtn.addEventListener('click', () => {
        if (game.undo()) {
            render();
        }
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

    // Mouseover for Stack Highlighting
    app.addEventListener('mouseover', (e) => {
        const cardEl = e.target.closest('.card');
        if (!cardEl) return;

        // Ignore face down cards
        if (cardEl.classList.contains('face-down')) return;

        const cardId = cardEl.dataset.id;
        const location = game.findCard(cardId);

        if (!location) return;

        // Only highlight tableau stacks
        if (location.type === 'tableau') {
            const pile = game.tableau[location.index];
            const cardIndex = pile.indexOf(location.card);

            // Find the "Top Run" - the longest valid sequence ending at the top
            let topRunStartIndex = pile.length - 1;
            // Scan backwards to find where validity breaks
            // Note: isValidSubStack checks i to end.
            // We want the smallest i such that isValidSubStack(pile, i) is true.

            // Optimization: Find first face-up
            const firstFaceUp = pile.findIndex(c => c.faceUp);
            if (firstFaceUp !== -1) {
                for (let i = firstFaceUp; i < pile.length; i++) {
                    if (game.isValidSubStack(pile, i)) {
                        topRunStartIndex = i;
                        break;
                    }
                }
            }

            // Determine what to highlight
            let highlightStartIndex = -1;

            // If hovering within the Top Run, highlight the WHOLE Top Run
            if (cardIndex >= topRunStartIndex) {
                highlightStartIndex = topRunStartIndex;
            } else {
                // Hovering a card blocked by invalid sequence?
                // Check if the card itself starts a valid stack (e.g. valid sub-segment buried)
                // Even if it's buried, if it's a valid segment, maybe user wants to see it?
                // But usually we only highlight movable stuff.
                // If it's buried, it's not movable.
                // However, for consistency, let's highlighting valid sub-segments if hovered.
                if (game.isValidSubStack(pile, cardIndex)) {
                    highlightStartIndex = cardIndex;
                }
            }

            if (highlightStartIndex !== -1) {
                // Determine stack properties
                const stackSize = pile.length - highlightStartIndex;
                const cardHeight = 112; // From CSS
                const cardOffset = 30; // From CSS/JS render logic

                // Calculate overlay dimensions
                // Height = (cards-1)*offset + cardHeight
                const overlayHeight = ((stackSize - 1) * cardOffset) + cardHeight;
                const topPos = highlightStartIndex * cardOffset;

                // Create or find overlay
                let overlay = document.getElementById('stack-highlight-overlay');
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'stack-highlight-overlay';
                }

                // Append to the pile container (tableau-pile)
                const tableauPileEl = tableauEls[location.index];

                // If appending to tableauPileEl, it's relative, so absolute pos works
                if (overlay.parentElement !== tableauPileEl) {
                    tableauPileEl.appendChild(overlay);
                }

                overlay.style.height = `${overlayHeight}px`;
                overlay.style.top = `${topPos}px`;
                overlay.style.left = '0px'; // Align with pile
            }
        }
    });

    // Mouseout to remove highlights
    app.addEventListener('mouseout', (e) => {
        const cardEl = e.target.closest('.card');
        if (!cardEl) return;

        // If moving to a child element (or staying within the card), ignore
        if (e.relatedTarget && cardEl.contains(e.relatedTarget)) {
            return;
        }

        // Also ignore if moving to the overlay itself?
        // Overlay has pointer-events: none, so relatedTarget should check what's behind it?
        // Actually, if we leave the card and enter the "gap" in the pile, we might still want to highlight?
        // But for now, strictly implementing "remove if leaving card" is safest.

        // Remove overlay
        const overlay = document.getElementById('stack-highlight-overlay');
        if (overlay) {
            overlay.remove();
        }
    });
}

// Helper for tap-to-move state
let selectedCard = null;
let selectedSource = null;

function setupTouchEvents() {
    let touchDragCard = null;
    let touchSourcePile = null;
    let dragGhost = null;
    let touchOffsetX = 0;
    let touchOffsetY = 0;

    let startX = 0;
    let startY = 0;
    let isDragging = false;

    app.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        isDragging = false;

        // Potential drag start, but wait for move to confirm
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (target) {
            const cardEl = target.closest('.card');
            if (cardEl && !cardEl.classList.contains('face-down')) {
                const cardId = cardEl.dataset.id;
                const location = game.findCard(cardId);
                if (location) {
                    touchDragCard = location.card;
                    touchSourcePile = { type: location.type, index: location.index };
                    // Calculate partial offset just in case it becomes a drag
                    const rect = cardEl.getBoundingClientRect();
                    touchOffsetX = touch.clientX - rect.left;
                    touchOffsetY = touch.clientY - rect.top;
                }
            }
        }
    }, { passive: false });

    app.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        const dist = Math.sqrt(Math.pow(touch.clientX - startX, 2) + Math.pow(touch.clientY - startY, 2));

        // Threshold for drag
        if (dist > 10) {
            isDragging = true;
            if (touchDragCard && !dragGhost) {
                // Initialize Drag Ghost
                e.preventDefault(); // Stop scroll only if we are dragging a card
                initiateDragGhost(touchDragCard, touchSourcePile, touch.clientX, touch.clientY, touchOffsetX, touchOffsetY);
            }
        }

        if (isDragging && dragGhost) {
            e.preventDefault();
            dragGhost.style.left = `${touch.clientX - touchOffsetX}px`;
            dragGhost.style.top = `${touch.clientY - touchOffsetY}px`;
        }
    }, { passive: false });

    app.addEventListener('touchend', (e) => {
        // Drag End Logic
        if (isDragging) {
            if (dragGhost) {
                const touch = e.changedTouches[0];
                // temporarily hide ghost to find drop target
                dragGhost.style.display = 'none';
                let dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
                dragGhost.style.display = 'block';

                document.body.removeChild(dragGhost);
                dragGhost = null;

                if (dropTarget) {
                    handleDrop(dropTarget, touchDragCard, touchSourcePile);
                }
            }
        } else {
            // TAP Logic
            const touch = e.changedTouches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            if (target) {
                // Check if background tap (deselect all)
                if (target.id === 'app' || target.id === 'game-board') {
                    deselectAll();
                    return;
                }
                handleTap(target);
            }
        }

        // Reset immediate drag vars
        touchDragCard = null;
        touchSourcePile = null;
        isDragging = false;
    });

    function initiateDragGhost(card, sourceLocation, clientX, clientY, offsetX, offsetY) {
        // Create Ghost
        dragGhost = document.createElement('div');
        dragGhost.id = 'touch-drag-ghost';
        dragGhost.style.position = 'fixed';
        dragGhost.style.zIndex = '9999';
        dragGhost.style.pointerEvents = 'none';

        // Clone the relevant stack
        const cardEl = document.getElementById(card.id);
        if (!cardEl) return; // Should not happen

        if (sourceLocation.type === 'tableau') {
            const pile = game.tableau[sourceLocation.index];
            const cardIndex = pile.indexOf(card);

            // Container stack
            for (let i = cardIndex; i < pile.length; i++) {
                const c = pile[i];
                const originalEl = document.querySelector(`.card[data-id="${c.id}"]`);
                if (originalEl) {
                    const clone = originalEl.cloneNode(true);
                    clone.style.position = 'absolute';
                    clone.style.top = `${(i - cardIndex) * 30}px`;
                    clone.style.left = '0px';
                    // Remove ID from clone to avoid dupes? Or keep for visual.
                    clone.removeAttribute('id');
                    dragGhost.appendChild(clone);
                }
            }
        } else {
            // Single card
            const clone = cardEl.cloneNode(true);
            clone.style.position = 'absolute';
            clone.style.top = '0';
            clone.style.left = '0';
            dragGhost.appendChild(clone);
        }

        // Initial position
        dragGhost.style.left = `${clientX - offsetX}px`;
        dragGhost.style.top = `${clientY - offsetY}px`;

        document.body.appendChild(dragGhost);
    }
}

function handleTap(target) {
    const cardEl = target.closest('.card');
    const foundationEl = target.closest('.foundation');
    const tableauEl = target.closest('.tableau-pile');

    // 1. Tapping a Card
    if (cardEl) {
        if (cardEl.classList.contains('face-down')) return; // Ignore face down

        const cardId = cardEl.dataset.id;
        const location = game.findCard(cardId);
        if (!location) return;

        // If we already have a selection, this might be a target or a new selection
        if (selectedCard) {
            // Tapping itself? Deselect
            if (selectedCard.id === cardId) {
                deselectAll();
                return;
            }

            // Tapping another card. Is it a valid target for the currently selected card?
            // "Target" means the pile containing this card.
            // Check move logic.
            const targetPileType = location.type;
            const targetPileIndex = location.index;

            // Attempt Move
            attemptMove(selectedCard, selectedSource, targetPileType, targetPileIndex);
        } else {
            // No selection -> Select this card (if it's a valid source)
            // Valid source? Top card OR valid substack start.
            // We use logic similar to isValidSubStack.
            // Actually, any card in tableau *can* be selected, checking validity happens on move?
            // User requested: "if I touch a red five... I can then touch a black six"
            // So we select the red five.
            selectCard(location.card, location);
        }
        return;
    }

    // 2. Tapping an Empty Pile (Tableau or Foundation)
    if (selectedCard) {
        if (foundationEl) {
            const slotIndex = parseInt(foundationEl.dataset.index);
            attemptMove(selectedCard, selectedSource, 'foundation', slotIndex);
        } else if (tableauEl) {
            const tableauIndex = tableauEls.indexOf(tableauEl);
            if (tableauIndex !== -1) {
                attemptMove(selectedCard, selectedSource, 'tableau', tableauIndex);
            }
        }
    }
}

function selectCard(card, location) {
    deselectAll(); // Clear previous

    // Validate if it can be selected/moved?
    // In Solitaire, you can grab any face up card, but can only move valid stacks.
    // If in tableau, check validity if it's below top.
    if (location.type === 'tableau') {
        const pile = game.tableau[location.index];
        const index = pile.indexOf(card);
        if (index < pile.length - 1) {
            if (!game.isValidSubStack(pile, index)) {
                // Invalid stack, maybe don't select? Or select just to error later?
                // Better UI: don't select invalid stacks.
                return;
            }
        }
    }

    selectedCard = card;
    selectedSource = { type: location.type, index: location.index };

    // Visuals
    // If it's a stack, select all
    if (location.type === 'tableau') {
        const pile = game.tableau[location.index];
        const index = pile.indexOf(card);
        for (let i = index; i < pile.length; i++) {
            const c = pile[i];
            const el = document.getElementById(c.id);
            if (el) el.classList.add('selected');
        }
    } else {
        const el = document.getElementById(card.id);
        if (el) el.classList.add('selected');
    }
}

function deselectAll() {
    selectedCard = null;
    selectedSource = null;
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
}

function attemptMove(card, source, targetType, targetIndex) {
    // Check validity first to avoid animation if invalid
    // But Game logic does the check.
    // We can simulate check or just trust Game logic return.
    // But we need to know IF valid to animate correctly.

    // We can use a "Dry Run" check? No easy way without duplicating logic.
    // Actually, animate first? No, that looks bad if it snaps back.
    // Valid check:
    let isValid = false;

    // Simple pre-checks based on game rules to allow animation confidence
    // Or, we hack: modify game state, if fail, revert?
    // Better: Duplicate simple validation logic here or expose it in Game.

    // Let's rely on game logic for the actual move, but we want to animate "flying".
    // "Touch a red five, touch a black six".
    // 1. Check if valid move. 
    // We'll call game logic. If true, we UNDO the move (visually/state), animate, then REDO?
    // Or just animate then call game logic?
    // If we call game logic, it updates state instantly. 'render()' updates DOM.
    // We want: 1. Validate. 2. Animate (0.1s). 3. Update State/Render.

    // Let's implement specific validation helpers or use try/catch if we had transaction support.
    // We will assume "if it works, it works".
    // We can animate "tentatively"? 

    // Plan:
    // 1. Calculate Target Rect.
    // 2. Animate clone from Source to Target.
    // 3. IF animation finishes, Call Game Logic.
    // 4. If Game Logic returns false, we wasted an animation (ghost snaps back or disappears).
    // THIS is the user expectation: they see it fly, if it rejects, it flies back or poofs.

    animateFlyingMove(card, source, targetType, targetIndex);
}

function animateFlyingMove(card, source, targetType, targetIndex) {
    // 1. Create Ghost Stacks
    const pile = (source.type === 'tableau') ? game.tableau[source.index] : null;
    let cardsToMove = [card];
    if (pile) {
        const index = pile.indexOf(card);
        cardsToMove = pile.slice(index);
    }

    const startRect = document.getElementById(card.id).getBoundingClientRect();

    // Target Rect
    let targetEl;
    if (targetType === 'tableau') targetEl = tableauEls[targetIndex];
    else targetEl = foundationEls.find(el => parseInt(el.dataset.index) === targetIndex && el.dataset.suit === card.suit); // Approx for foundation

    // If foundation search failed (e.g. empty foundation of different suit? No, suit must match)
    if (targetType === 'foundation' && !targetEl) {
        // Find correct foundation pile element based on suit/index logic provided in render/setup
        targetEl = document.querySelector(`.foundation[data-suit="${card.suit}"][data-index="${targetIndex}"]`);
    }

    if (!targetEl) return; // Should not happen

    // Get exact target position (top of pile)
    const targetRect = targetEl.getBoundingClientRect();
    // Offset calculation for tableau drop
    let targetTopOffset = 0;
    if (targetType === 'tableau') {
        const targetPile = game.tableau[targetIndex];
        targetTopOffset = (targetPile.length) * 30; // 30px per card
    }

    // Create Flying Container
    const ghost = document.createElement('div');
    ghost.style.position = 'fixed';
    ghost.style.left = `${startRect.left}px`;
    ghost.style.top = `${startRect.top}px`;
    ghost.style.zIndex = '2000';
    ghost.style.transition = 'all 0.1s ease-out'; // THE 0.1s ANIMATION

    // Clone cards into ghost
    cardsToMove.forEach((c, i) => {
        const el = document.getElementById(c.id);
        if (el) {
            const clone = el.cloneNode(true);
            clone.style.position = 'absolute';
            clone.style.top = `${i * 30}px`;
            clone.style.left = '0';
            clone.classList.remove('selected');
            ghost.appendChild(clone);
        }
    });

    document.body.appendChild(ghost);

    // Trigger Reflow
    ghost.getBoundingClientRect();

    // Animate to Target
    // X: targetRect.left
    // Y: targetRect.top + targetTopOffset
    // +2 for border alignment typically
    ghost.style.left = `${targetRect.left + 2}px`; /* +2 border */
    ghost.style.top = `${targetRect.top + targetTopOffset + 2}px`;

    // Wait for animation end to commit move
    setTimeout(() => {
        // Execute Logic
        let success = false;
        if (targetType === 'tableau') {
            success = game.moveCardToTableau(card, source.type, source.index, targetIndex);
        } else {
            success = game.moveCardToFoundation(card, source.type, source.index, targetIndex);
        }

        ghost.remove();
        deselectAll();

        if (success) {
            render();
        } else {
            // Optional: Animate "Return" or visually indicate failure (shake)?
        }
    }, 100); // 0.1s
}

function handleDrop(dropTarget, card, source) {
    const tableauPile = dropTarget.closest('.tableau-pile');
    const foundationPile = dropTarget.closest('.foundation');

    let moveSuccessful = false;
    if (tableauPile) {
        const targetIndex = tableauEls.indexOf(tableauPile);
        if (targetIndex !== -1) {
            moveSuccessful = game.moveCardToTableau(card, source.type, source.index, targetIndex);
        }
    } else if (foundationPile) {
        const suit = foundationPile.dataset.suit;
        const slotIndex = parseInt(foundationPile.dataset.index);
        if (card.suit === suit) {
            moveSuccessful = game.moveCardToFoundation(card, source.type, source.index, slotIndex);
        }
    }

    if (moveSuccessful) render();
}

init();
