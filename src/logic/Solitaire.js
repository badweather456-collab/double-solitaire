import { Deck } from '../models/Deck.js';
import { Card, COLORS, RANKS } from '../models/Card.js';

export class Solitaire {
    constructor() {
        this.deck = new Deck(2); // 2 decks for double solitaire
        this.stock = [];
        this.waste = [];
        this.foundations = {
            hearts: [[], []],
            diamonds: [[], []],
            clubs: [[], []],
            spades: [[], []]
        };
        this.tableau = [[], [], [], [], [], [], [], [], [], []]; // 10 columns
    }

    startNewGame() {
        this.deck.shuffle();
        this.stock = [...this.deck.cards];
        this.waste = [];
        this.foundations = {
            hearts: [[], []],
            diamonds: [[], []],
            clubs: [[], []],
            spades: [[], []]
        };
        this.tableau = [[], [], [], [], [], [], [], [], [], []]; // 10 columns

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
        if (this.stock.length === 0) {
            // Recycle waste to stock
            if (this.waste.length > 0) {
                this.stock = this.waste.reverse().map(card => {
                    card.faceUp = false;
                    return card;
                });
                this.waste = [];
            }
        } else {
            const card = this.stock.pop();
            card.faceUp = true;
            this.waste.push(card);
        }
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
        if (sourcePileType === 'waste') {
            this.waste.pop();
        } else if (sourcePileType === 'tableau') {
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
        // Search waste
        if (this.waste.length > 0 && this.waste[this.waste.length - 1].id === cardId) {
            return { type: 'waste', index: null, card: this.waste[this.waste.length - 1] };
        }

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

        // Can only move from tableau or waste
        if (location.type !== 'tableau' && location.type !== 'waste') return false;

        // If from tableau, must be the top card (last in array)
        if (location.type === 'tableau') {
            const pile = this.tableau[location.index];
            if (pile[pile.length - 1] !== card) return false;
        }

        // Use moveCardToFoundation which handles the 2-slot logic
        return this.moveCardToFoundation(card, location.type, location.index);
    }
}
