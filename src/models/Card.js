export const SUITS = {
    HEARTS: 'hearts',
    DIAMONDS: 'diamonds',
    CLUBS: 'clubs',
    SPADES: 'spades'
};

export const RANKS = {
    ACE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
    SIX: 6,
    SEVEN: 7,
    EIGHT: 8,
    NINE: 9,
    TEN: 10,
    JACK: 11,
    QUEEN: 12,
    KING: 13
};

export const COLORS = {
    RED: 'red',
    BLACK: 'black'
};

export class Card {
    constructor(suit, rank, deckNumber = 1) {
        this.suit = suit;
        this.rank = rank;
        this.faceUp = false;
        this.deckNumber = deckNumber; // Track which deck (1 or 2)
        this.id = `${suit}-${rank}-${deckNumber}-${Math.random().toString(36).substr(2, 9)}`; // Unique ID for DOM
    }

    get color() {
        return (this.suit === SUITS.HEARTS || this.suit === SUITS.DIAMONDS) ? COLORS.RED : COLORS.BLACK;
    }

    get rankString() {
        switch (this.rank) {
            case 1: return 'A';
            case 11: return 'J';
            case 12: return 'Q';
            case 13: return 'K';
            default: return this.rank.toString();
        }
    }

    get suitSymbol() {
        switch (this.suit) {
            case SUITS.HEARTS: return '♥';
            case SUITS.DIAMONDS: return '♦';
            case SUITS.CLUBS: return '♣';
            case SUITS.SPADES: return '♠';
            default: return '';
        }
    }

    flip() {
        this.faceUp = !this.faceUp;
    }
}
