import { Deck } from '../models/Deck.js';
import { Card, COLORS, RANKS } from '../models/Card.js';

export class Solitaire {
    constructor() {
        this.deck = new Deck(2); // 2 decks for double solitaire
        this.stock = [];
        this.foundations = {
            hearts: [[], []],
            diamonds: [[], []],
            clubs: [[], []],
            spades: [[], []]
        };
        this.tableau = [[], [], [], [], [], [], [], [], [], []]; // 10 columns
        this.stateHistory = new Set();
    }

    startNewGame() {
        this.deck.shuffle();
        this.stock = [...this.deck.cards];
        // Waste removed
        this.foundations = {
            hearts: [[], []],
            diamonds: [[], []],
            clubs: [[], []],
            spades: [[], []]
        };
        this.tableau = [[], [], [], [], [], [], [], [], [], []]; // 10 columns
        this.stateHistory = new Set();

        this.deal();
    }

    deal() {
        // Deal to tableau - Column i has (i+1) cards
        // Column 0: 1 card, Column 1: 2 cards, ..., Column 9: 10 cards
        // If column number is even, first card face up; if odd, first card face down
        // Cards alternate face up/down within each column
        for (let col = 0; col < 10; col++) {
            const numCardsInColumn = col + 1;
            const firstCardFaceUp = col % 2 === 0; // Even columns start face up

            for (let cardNum = 0; cardNum < numCardsInColumn; cardNum++) {
                const card = this.stock.pop();
                // Alternate face up/down starting with firstCardFaceUp
                if (firstCardFaceUp) {
                    card.faceUp = cardNum % 2 === 0; // 0, 2, 4... face up
                } else {
                    card.faceUp = cardNum % 2 === 1; // 1, 3, 5... face up
                }
                this.tableau[col].push(card);
            }
        }
    }

    drawFromStock() {
        // Deal 1 card to each ELIGIBLE tableau column
        // Rules:
        // 1. Skip Column 0 (Index 0).
        // 2. Skip empty columns.
        // 3. Skip columns that start with a King and are a valid sequence.

        if (this.stock.length === 0) return [];

        const moves = [];

        // Iterate through columns 1 to 9 (Skip 0)
        for (let i = 1; i < 10; i++) {
            if (this.stock.length === 0) break;

            const pile = this.tableau[i];

            // Rule 2: Skip empty
            if (pile.length === 0) continue;

            // Rule 3: Skip valid King sequence
            // Clarification: Only skip if the King is the FIRST card of the column (Index 0).
            // If there are face-down cards below the King, we should NOT skip.
            const firstFaceUpIndex = pile.findIndex(c => c.faceUp);

            // Check if strict start of column
            if (firstFaceUpIndex === 0) {
                const firstFaceUp = pile[firstFaceUpIndex];
                if (firstFaceUp.rank === RANKS.KING) {
                    if (this.isValidSubStack(pile, firstFaceUpIndex)) {
                        continue; // Skip this column
                    }
                }
            }

            // Deal card
            const card = this.stock.pop();
            card.faceUp = true;
            pile.push(card);
            moves.push({ card, targetIndex: i });
        }

        return moves;
    }

    // Validation Helpers
    isValidTableauMove(card, targetPileIndex) {
        const targetPile = this.tableau[targetPileIndex];

        // If pile is empty, only King allowed
        if (targetPile.length === 0) {
            return card.rank === RANKS.KING;
        }

        const topCard = targetPile[targetPile.length - 1];

        // Must be alternating color and descending rank
        return (card.color !== topCard.color) && (card.rank === topCard.rank - 1);
    }

    isValidSubStack(pile, startIndex) {
        // Check if all cards from startIndex to end are in sequence
        for (let i = startIndex; i < pile.length - 1; i++) {
            const current = pile[i];
            const next = pile[i + 1];
            if (current.color === next.color || current.rank !== next.rank + 1) {
                return false;
            }
        }
        return true;
    }

    isValidFoundationMove(card, slotIndex = null) {
        const foundationSlots = this.foundations[card.suit];

        // If slot specified, check that specific slot
        if (slotIndex !== null) {
            const foundation = foundationSlots[slotIndex];
            if (foundation.length === 0) {
                return card.rank === RANKS.ACE;
            }
            const topCard = foundation[foundation.length - 1];
            return card.rank === topCard.rank + 1;
        }

        // Otherwise, check if valid for ANY slot
        for (let i = 0; i < foundationSlots.length; i++) {
            const foundation = foundationSlots[i];
            if (foundation.length === 0 && card.rank === RANKS.ACE) {
                return true;
            }
            if (foundation.length > 0) {
                const topCard = foundation[foundation.length - 1];
                if (card.rank === topCard.rank + 1) {
                    return true;
                }
            }
        }
        return false;
    }

    // Move Execution
    moveCardToTableau(card, sourcePileType, sourceIndex, targetTableauIndex) {
        // Check validity of the move for the base card
        if (!this.isValidTableauMove(card, targetTableauIndex)) {
            return false;
        }

        // If source is tableau, we might be moving a stack
        let cardsToMove = [card];
        if (sourcePileType === 'tableau') {
            const sourcePile = this.tableau[sourceIndex];
            const cardIndex = sourcePile.indexOf(card);

            // If not the top card, check if it's a valid stack
            if (cardIndex < sourcePile.length - 1) {
                if (!this.isValidSubStack(sourcePile, cardIndex)) {
                    return false;
                }
                // Get all cards from this one to the top
                cardsToMove = sourcePile.slice(cardIndex);

                // Ensure all cards in the stack are face-up
                if (!cardsToMove.every(c => c.faceUp)) {
                    return false;
                }
            }
        }

        // Remove from source
        this.removeFromSource(card, sourcePileType, sourceIndex, cardsToMove.length);

        // Add to target
        this.tableau[targetTableauIndex].push(...cardsToMove);
        return true;
    }

    moveCardToFoundation(card, sourcePileType, sourceIndex, slotIndex = null) {
        // Foundations only accept single cards (top of stack)
        if (sourcePileType === 'tableau') {
            const sourcePile = this.tableau[sourceIndex];
            if (sourcePile.indexOf(card) !== sourcePile.length - 1) {
                return false; // Can't move a stack to foundation
            }
        }

        const foundationSlots = this.foundations[card.suit];

        // If slot specified, use that slot
        if (slotIndex !== null) {
            if (!this.isValidFoundationMove(card, slotIndex)) return false;
            this.removeFromSource(card, sourcePileType, sourceIndex, 1);
            foundationSlots[slotIndex].push(card);
            return true;
        }

        // Otherwise, find first valid slot
        for (let i = 0; i < foundationSlots.length; i++) {
            if (this.isValidFoundationMove(card, i)) {
                this.removeFromSource(card, sourcePileType, sourceIndex, 1);
                foundationSlots[i].push(card);
                return true;
            }
        }

        return false;
    }

    removeFromSource(card, sourcePileType, sourceIndex, count = 1) {
        if (sourcePileType === 'tableau') {
            const pile = this.tableau[sourceIndex];
            const cardIndex = pile.indexOf(card);

            if (cardIndex > -1) {
                pile.splice(cardIndex, count);
            }

            // DO NOT auto-flip - user must click to flip
        } else if (sourcePileType === 'foundation') {
            // For foundations, we need the slotIndex from sourceIndex
            // This is a bit awkward - we'll need to pass slotIndex separately
            // For now, find which slot has this card
            const slots = this.foundations[card.suit];
            for (let i = 0; i < slots.length; i++) {
                if (slots[i].length > 0 && slots[i][slots[i].length - 1].id === card.id) {
                    slots[i].pop();
                    break;
                }
            }
        }
    }

    flipTopCard(tableauIndex) {
        const pile = this.tableau[tableauIndex];
        if (pile.length > 0) {
            const topCard = pile[pile.length - 1];
            if (!topCard.faceUp) {
                topCard.faceUp = true;
                return true;
            }
        }
        return false;
    }

    // Helper to find card location
    findCard(cardId) {
        // Search tableau (10 piles for double solitaire)
        for (let i = 0; i < 10; i++) {
            const pile = this.tableau[i];
            const card = pile.find(c => c.id === cardId);
            if (card) return { type: 'tableau', index: i, card };
        }

        // Search foundations
        for (const suit in this.foundations) {
            const slots = this.foundations[suit];
            for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
                const pile = slots[slotIndex];
                if (pile.length > 0 && pile[pile.length - 1].id === cardId) {
                    return { type: 'foundation', index: suit, slotIndex, card: pile[pile.length - 1] };
                }
            }
        }

        return null;
    }

    autoMoveToFoundation(card) {
        const location = this.findCard(card.id);
        if (!location) return false;

        // Can only move from tableau
        if (location.type !== 'tableau') return false;

        // If from tableau, must be the top card (last in array)
        if (location.type === 'tableau') {
            const pile = this.tableau[location.index];
            if (pile[pile.length - 1] !== card) return false;
        }

        // Use moveCardToFoundation which handles the 2-slot logic
        return this.moveCardToFoundation(card, location.type, location.index);
    }

    // Game State Analysis
    getAvailableMoves() {
        const moves = [];

        // 1. Stock Moves
        const stockMoves = this.getPotentialStockMoves();
        moves.push(...stockMoves);

        // 2. Foundation to Tableau Moves (New Rule)
        for (const suit in this.foundations) {
            const slots = this.foundations[suit];
            slots.forEach((slot, slotIndex) => {
                if (slot.length > 0) {
                    const card = slot[slot.length - 1]; // Top card

                    // Exclude Aces from being moved back to tableau (User Rule)
                    if (card.rank === 1) return; // Skip Ace

                    // Check if this card can move to any tableau column
                    for (let targetCol = 0; targetCol < 10; targetCol++) {
                        if (this.isValidTableauMove(card, targetCol)) {
                            moves.push({
                                type: 'tableau', // Destination type
                                source: 'foundation',
                                sourceIndex: suit, // Suit is the 'index' key for foundations object
                                slotIndex: slotIndex, // Specific pile within suit
                                targetIndex: targetCol,
                                card: card
                            });
                        }
                    }
                }
            });
        }

        // 3. Tableau Moves (to Foundation or other Tableau columns)
        for (let i = 0; i < 10; i++) {
            const pile = this.tableau[i];
            if (pile.length === 0) continue;

            // Check top card for Foundation moves
            const topCard = pile[pile.length - 1];

            // 2a. Flip Face-Down Card logic
            // If top card is face down, we MUST flip it. That is a valid "move".
            if (!topCard.faceUp) {
                moves.push({
                    type: 'flip_card',
                    sourceIndex: i
                });
                // If it's face down, we can't move it anywhere else yet.
                continue;
            }

            if (this.isValidFoundationMove(topCard)) {
                moves.push({
                    type: 'foundation',
                    source: 'tableau',
                    sourceIndex: i,
                    card: topCard
                });
            }

            // Check all valid substacks for Tableau moves
            // We can move any face-up card that starts a valid substack
            const firstFaceUpIndex = pile.findIndex(c => c.faceUp);
            if (firstFaceUpIndex !== -1) {
                for (let j = firstFaceUpIndex; j < pile.length; j++) {
                    const card = pile[j];
                    // Must be a valid substack from here to top
                    if (this.isValidSubStack(pile, j)) {
                        // Check if this substack can move to any OTHER tableau column
                        for (let targetCol = 0; targetCol < 10; targetCol++) {
                            if (i === targetCol) continue;
                            if (this.isValidTableauMove(card, targetCol)) {
                                moves.push({
                                    type: 'tableau',
                                    source: 'tableau',
                                    sourceIndex: i,
                                    targetIndex: targetCol,
                                    card: card
                                });
                            }
                        }
                    }
                }
            }
        }

        return moves;
    }

    getPotentialStockMoves() {
        if (this.stock.length === 0) return [];

        const moves = [];
        // Simulate drawFromStock logic to see if any cards WOULD be dealt
        // Note: We don't need to know WHICH card, just that a move is possible.
        // But drawFromStock actually deals multiple cards at once (one per eligible column).
        // If it deals at least one card, that counts as a move.

        for (let i = 1; i < 10; i++) {
            const pile = this.tableau[i];

            // Rule 2: Skip empty
            if (pile.length === 0) continue;

            // Rule 3: Skip valid King sequence
            const firstFaceUpIndex = pile.findIndex(c => c.faceUp);
            if (firstFaceUpIndex === 0) {
                const firstFaceUp = pile[firstFaceUpIndex];
                if (firstFaceUp.rank === 13) { // RANKS.KING
                    if (this.isValidSubStack(pile, firstFaceUpIndex)) {
                        continue; // This column would be skipped
                    }
                }
            }

            // If we get here, this column would receive a card
            // Since dealing from stock is a single atomic action that affects all eligible columns,
            // we only need to represent it as one "move" in the available moves list.
            moves.push({ type: 'stock_deal' });
            return moves; // One valid action is enough to say "Stock is an option"
        }

        return moves;
    }

    checkGameState() {
        // 1. Snapshot current state
        const currentHash = this.getGameStateHash();

        // Debug Log
        console.log(`[GameState] Current Hash: ${currentHash.substring(0, 20)}...`);
        console.log(`[GameState] History Size: ${this.stateHistory.size}`);

        this.stateHistory.add(currentHash);

        // 2. Get available moves
        const moves = this.getAvailableMoves();
        console.log(`[GameState] Available Moves Count: ${moves.length}`);

        // Detailed Move Logging
        moves.forEach((m, i) => {
            let desc = m.type;
            if (m.card) desc += ` (${m.card.rankString}${m.card.suitSymbol})`;
            if (m.sourceIndex !== undefined) desc += ` from T${m.sourceIndex}`;
            if (m.targetIndex !== undefined) desc += ` to T${m.targetIndex}`;
            console.log(`  Move ${i}: ${desc}`);
        });

        // 3. Check for Effective Stalemate (Loop)
        let loopDetected = false;
        if (moves.length > 0) {
            // Simulate all moves
            // If ALL moves result in a state we have already seen, it's a loop.

            let allMovesLeadToHistory = true;

            moves.forEach((move, idx) => {
                // Short circuit optimization: if we already found a NEW state, we can skip detailed logging/sim if we want, 
                // but for debugging let's log everything or break early.
                if (!allMovesLeadToHistory) return;

                // Clone the game
                const simulation = this.clone();

                // Apply move
                simulation.applyMove(move);

                // Check hash
                const futureHash = simulation.getGameStateHash();
                const isRepeated = this.stateHistory.has(futureHash);

                console.log(`[LoopCheck] Move ${idx} (${move.type}) -> Hash: ${futureHash.substring(0, 20)}... | Seen: ${isRepeated}`);

                if (!isRepeated) {
                    allMovesLeadToHistory = false;
                    // break not possible in forEach, but logic handles it
                }
            });

            if (allMovesLeadToHistory) {
                console.warn("[GameState] LOOP DETECTED! All moves lead to past states.");
                loopDetected = true;
            }
        } else {
            if (this.stock.length === 0) {
                console.warn("[GameState] STALEMATE! No moves and empty stock.");
            }
        }

        return {
            gameOver: (moves.length === 0 && this.stock.length === 0) || loopDetected,
            loopDetected: loopDetected,
            movesAvailable: moves.length
        };
    }

    // Simulation Helpers
    clone() {
        const clone = new Solitaire();

        // Helper to clone a card
        const cloneCard = (c) => {
            const newCard = new Card(c.suit, c.rank, c.deckNumber);
            newCard.faceUp = c.faceUp;
            newCard.id = c.id;
            return newCard;
        };

        // Deep copy state restoring Card instances
        clone.stock = this.stock.map(cloneCard);

        clone.foundations = {};
        for (const suit in this.foundations) {
            clone.foundations[suit] = this.foundations[suit].map(pile => pile.map(cloneCard));
        }

        clone.tableau = this.tableau.map(pile => pile.map(cloneCard));

        // State History
        clone.stateHistory = new Set(this.stateHistory);

        return clone;
    }

    getGameStateHash() {
        // Semantic Hashing: Use Rank, Suit, and FaceUp status.
        // This ensures that swapping two identical cards (e.g. 5 of Hearts from Deck 1 vs Deck 2)
        // results in the SAME hash, matching user intuition that the "state" hasn't changed.

        const getCardSig = (c) => `${c.rank}:${c.suit}:${c.faceUp ? 'U' : 'D'}`;

        const state = {
            stock: this.stock.map(getCardSig),
            tableau: this.tableau.map(col => col.map(getCardSig))
        };

        // Standardize foundations 
        const foundationKeys = Object.keys(this.foundations).sort();
        const cleanFoundations = foundationKeys.map(suit => ({
            suit: suit,
            piles: this.foundations[suit].map(slot => slot.map(getCardSig))
        }));

        state.foundations = cleanFoundations;

        return JSON.stringify(state);
    }

    applyMove(move) {
        if (move.type === 'stock_deal') {
            this.drawFromStock();
        } else if (move.type === 'foundation') {
            if (move.source === 'tableau') {
                // Find equivalent card in this instance
                const card = this.findCardById(move.card.id);
                if (card) {
                    this.moveCardToFoundation(card, 'tableau', move.sourceIndex);
                }
            }
        } else if (move.type === 'tableau') {
            if (move.source === 'tableau') {
                // Find equivalent card in this instance
                const card = this.findCardById(move.card.id);
                if (card) {
                    this.moveCardToTableau(card, 'tableau', move.sourceIndex, move.targetIndex);
                }
            } else if (move.source === 'foundation') {
                // Find equivalent card in this instance
                const card = this.findCardById(move.card.id);
                if (card) {
                    // Logic for moving FROM foundation is handled by moveCardToTableau 
                    // provided we give it the right params.
                    // However, moveCardToTableau calls removeFromSource which needs valid args.
                    // Actually removeFromSource for foundation scans for the card if we just pass 'foundation' and valid suit/index?
                    // Let's check removeFromSource: it uses card.suit to find the slot if sourceIndex is not helpful.
                    // But in applyMove we want to be safe.
                    this.moveCardToTableau(card, 'foundation', move.sourceIndex, move.targetIndex);
                }
            }
        } else if (move.type === 'flip_card') {
            this.flipTopCard(move.sourceIndex);
        }
    }

    findCardById(id) {
        // Search tableau
        for (const pile of this.tableau) {
            const card = pile.find(c => c.id === id);
            if (card) return card;
        }
        // Search foundations (unlikely needed for source, but for completeness)
        for (const suit in this.foundations) {
            for (const slot of this.foundations[suit]) {
                const card = slot.find(c => c.id === id);
                if (card) return card;
            }
        }
        return null; // Should not happen if logic is correct
    }


}
