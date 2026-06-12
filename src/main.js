import { Solitaire } from './logic/Solitaire.js?v=32';

const game = new Solitaire();
const app = document.getElementById('app');

// DOM Elements
const stockEl = document.getElementById('stock');
const stockCountEl = document.getElementById('stock-count');
const undoBtn = document.getElementById('undo-btn');
const newGameBtn = document.getElementById('new-game-btn');
const newGameModal = document.getElementById('new-game-modal');
const newGameConfirmYes = document.getElementById('new-game-confirm-yes');
const newGameConfirmNo = document.getElementById('new-game-confirm-no');
const noProgressModal = document.getElementById('no-progress-modal');
const noProgressKeep = document.getElementById('no-progress-keep');
const noProgressNewGame = document.getElementById('no-progress-new-game');
const foundationEls = Array.from(document.querySelectorAll('.foundation'));
const tableauEls = Array.from(document.querySelectorAll('.tableau-pile'));

// --- Session persistence ---
const SAVE_KEY = 'double-solitaire-v1';

function saveGameState() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(game.serializeState()));
    } catch (_) {}
}

function loadGameState() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        game.restoreState(JSON.parse(raw));
        return true;
    } catch (_) {
        localStorage.removeItem(SAVE_KEY);
        return false;
    }
}

function clearGameState() {
    localStorage.removeItem(SAVE_KEY);
}

// True on desktop/mouse, false on touch-only devices (iPad, etc.)
const hasMousePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// State for drag and drop
let draggedCard = null;
let sourcePile = null; // { type: 'tableau'|'foundation', index: int|string }

function init() {
    if (!loadGameState()) {
        game.startNewGame();
    }
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

    // Persist state so a browser refresh resumes the same game
    saveGameState();

    // No-progress advisory — show every 10 consecutive non-productive moves
    if (game.movesSinceProgress > 0 && game.movesSinceProgress % 10 === 0) {
        noProgressModal.classList.add('show');
    }

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
                tempCard.style.pointerEvents = 'none';

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

            }, index * 200); // 0.2 second interval (faster dealing)
        });

        // After ALL animations complete, clean up and render
        // Total time = (moves.length - 1) * 2000 (start of last card) + 2000 (flight of last card)
        const totalDuration = (moves.length) * 200;

        setTimeout(() => {
            document.querySelectorAll('.flying-card').forEach(el => el.remove());
            render();
        }, totalDuration + 200); // buffer: last card starts at (n-1)*200, animates 150ms → need 200ms margin
    });

    // Undo Click
    undoBtn.addEventListener('click', () => {
        if (game.undo()) {
            render();
        }
    });

    // New Game Click — show confirmation modal
    newGameBtn.addEventListener('click', () => {
        newGameModal.classList.add('show');
    });

    newGameConfirmYes.addEventListener('click', () => {
        newGameModal.classList.remove('show');
        noProgressModal.classList.remove('show');
        clearGameState();
        deselectAll();
        document.getElementById('game-message').classList.add('hidden');
        game.startNewGame();
        render();
    });

    newGameConfirmNo.addEventListener('click', () => {
        newGameModal.classList.remove('show');
    });

    // No-progress advisory buttons
    noProgressKeep.addEventListener('click', () => {
        noProgressModal.classList.remove('show');
    });

    noProgressNewGame.addEventListener('click', () => {
        noProgressModal.classList.remove('show');
        clearGameState();
        deselectAll();
        document.getElementById('game-message').classList.add('hidden');
        game.startNewGame();
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

    // Click handler — face-down flip works on all devices; select/move on mouse only
    app.addEventListener('click', (e) => {
        const cardEl = e.target.closest('.card');

        // Face-down flip: all devices (touch relies on the synthetic click event)
        if (cardEl && cardEl.classList.contains('face-down')) {
            const tableauEl = cardEl.closest('.tableau-pile');
            if (!tableauEl) return;
            const tableauIndex = tableauEls.indexOf(tableauEl);
            if (tableauIndex === -1) return;
            if (game.flipTopCard(tableauIndex)) render();
            return;
        }

        // Click-to-select / click-to-move: mouse devices only
        // (touch devices use setupTouchEvents → handleTap instead)
        if (hasMousePointer) {
            if (e.target.id === 'app' || e.target.id === 'game-board') {
                deselectAll();
                return;
            }
            handleTap(e.target);
        }
    });

    // Mouseover for Stack Highlighting — mouse devices only
    app.addEventListener('mouseover', (e) => {
        if (!hasMousePointer) return;
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

    // Mouseout to remove highlights — mouse devices only
    app.addEventListener('mouseout', (e) => {
        if (!hasMousePointer) return;
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

        if (selectedCard) {
            // Tapping the root of the current selection → deselect
            if (selectedCard.id === cardId) {
                deselectAll();
                return;
            }

            // Try to move selected card/stack to this card's pile.
            // If the move is invalid, re-select this card instead.
            const moved = attemptMove(
                selectedCard, selectedSource, location.type, location.index
            );
            if (!moved) {
                selectCard(location.card, location);
            }
        } else {
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

    // Draw a single blue outline over the entire selected stack
    if (location.type === 'tableau') {
        const pile = game.tableau[location.index];
        const startIndex = pile.indexOf(card);
        const stackSize = pile.length - startIndex;
        const overlay = document.createElement('div');
        overlay.id = 'selection-overlay';
        overlay.style.top = `${startIndex * 30}px`;
        overlay.style.height = `${(stackSize - 1) * 30 + 112}px`;
        tableauEls[location.index].appendChild(overlay);
    } else {
        // Foundation card — highlight the single card directly
        const el = document.getElementById(card.id);
        if (el) el.classList.add('selected');
    }

    // Highlight every valid destination in yellow
    highlightValidTargets(card, location);
}

function highlightValidTargets(card, source) {
    // Tableau destinations
    for (let i = 0; i < 10; i++) {
        if (source.type === 'tableau' && source.index === i) continue;
        if (game.isValidTableauMove(card, i)) {
            const pile = game.tableau[i];
            if (pile.length === 0) {
                tableauEls[i].classList.add('valid-target');
            } else {
                const topCard = pile[pile.length - 1];
                const el = document.getElementById(topCard.id);
                if (el) el.classList.add('valid-target');
            }
        }
    }

    // Foundation destinations (only when moving a single top card)
    if (source.type === 'tableau') {
        const sourcePile = game.tableau[source.index];
        if (sourcePile[sourcePile.length - 1] === card) {
            game.foundations[card.suit].forEach((slot, slotIndex) => {
                if (game.isValidFoundationMove(card, slotIndex)) {
                    const el = document.querySelector(`.foundation[data-suit="${card.suit}"][data-index="${slotIndex}"]`);
                    if (el) el.classList.add('valid-target');
                }
            });
        }
    }
}

function deselectAll() {
    selectedCard = null;
    selectedSource = null;
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.valid-target').forEach(el => el.classList.remove('valid-target'));
    const overlay = document.getElementById('selection-overlay');
    if (overlay) overlay.remove();
}

function attemptMove(card, source, targetType, targetIndex) {
    // Validate before doing anything — returns false for illegal moves so the
    // caller can decide to re-select rather than silently do nothing.
    if (targetType === 'tableau') {
        if (!game.isValidTableauMove(card, targetIndex)) return false;
        if (source.type === 'tableau') {
            const pile = game.tableau[source.index];
            const cardIndex = pile.indexOf(card);
            if (cardIndex === -1) return false;
            if (cardIndex < pile.length - 1 && !game.isValidSubStack(pile, cardIndex)) return false;
        }
    } else if (targetType === 'foundation') {
        const slotIndex = typeof targetIndex === 'number' ? targetIndex : null;
        if (!game.isValidFoundationMove(card, slotIndex)) return false;
    }

    // Clear selection immediately so a rapid second tap (e.g. double-tap) cannot
    // trigger a second move for the same card while the animation is in flight.
    deselectAll();

    animateFlyingMove(card, source, targetType, targetIndex);
    return true;
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
