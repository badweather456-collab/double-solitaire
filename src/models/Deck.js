import { Card, SUITS, RANKS } from './Card.js';

export class Deck {
    constructor(numberOfDecks = 1) {
        this.cards = [];
        this.numberOfDecks = numberOfDecks;
        this.initialize();
    }

    initialize() {
        this.cards = [];
        for (let deckNum = 0; deckNum < this.numberOfDecks; deckNum++) {
            for (const suit of Object.values(SUITS)) {
                for (const rank of Object.values(RANKS)) {
                    this.cards.push(new Card(suit, rank, deckNum + 1)); // Pass deck number (1 or 2)
                }
            }
        }
    }

    shuffle() {
        // Fisher-Yates shuffle
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal() {
        return this.cards.pop();
    }

    get isEmpty() {
        return this.cards.length === 0;
    }

    get count() {
        return this.cards.length;
    }
}
