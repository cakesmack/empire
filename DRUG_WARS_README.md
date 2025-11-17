# Drug Wars - Classic Economic Simulation Game

A Python recreation of the classic 1984 text-based game by John E. Dell.

## Overview

Drug Wars is an economic simulation game where you play as a dealer traveling between different locations in New York City, buying and selling commodities to maximize your profit within 30 days.

## How to Play

### Starting the Game

```bash
python3 drug_wars.py
```

### Objective

- Start with $2,000 cash and $5,500 in debt
- Travel between 6 different NYC locations
- Buy low, sell high
- Maximize your net worth within 30 days
- Pay off your debt and become a Drug Lord!

### Game Mechanics

#### Cities
Travel between these locations:
- Bronx
- Ghetto
- Central Park
- Manhattan
- Coney Island
- Brooklyn

#### Available Actions

1. **Buy Drugs** - Purchase commodities at current market prices
2. **Sell Drugs** - Sell your inventory at current market prices
3. **Jet to Another City** - Travel to a new location (advances 1 day)
4. **Visit Loan Shark** - Pay off debt or borrow more money
5. **Visit Bank** - Deposit or withdraw cash (keeps money safe)
6. **Check Inventory** - View your current stash
7. **Quit Game** - End the game early

#### Commodities

The game includes 12 different commodities with varying price ranges:
- Acid
- Cocaine
- Hashish
- Heroin
- Ludes
- MDA
- Opium
- PCP
- Peyote
- Shrooms
- Speed
- Weed

#### Inventory

- You have a trench coat that can hold up to 100 units
- Manage your space carefully to maximize profits

#### Random Events

Watch out for these events:
- **Officer Hardass** - Police raid! You may need to dump your stash
- **Found Stash** - Find free commodities on the street
- **Mugged** - Lose a portion of your cash
- **Price Fluctuations** - Drastic price changes (buy low opportunities!)
- **Loan Shark Interest** - 10% interest charged every 5 days on outstanding debt

### Scoring

Your final rank is based on net worth (Cash + Bank - Debt + Inventory Value):

- **Drug Lord**: $250,000+
- **Kingpin**: $100,000 - $249,999
- **Big Timer**: $50,000 - $99,999
- **Dealer**: $20,000 - $49,999
- **Hustler**: $5,000 - $19,999
- **Street Dealer**: $0 - $4,999
- **Broke Junkie**: Negative net worth

### Strategy Tips

1. **Watch for market anomalies** - When you see messages about rock-bottom prices or prices going through the roof, act fast!
2. **Pay attention to price ranges** - Learn which commodities are worth trading
3. **Manage debt** - Pay it off early to avoid accumulating interest
4. **Use the bank** - Store excess cash to protect it from muggers
5. **Maximize inventory** - Keep your trench coat full when traveling
6. **Plan your route** - Travel efficiently between cities

## Technical Details

- Written in Python 3
- No external dependencies required
- Cross-platform compatible
- Text-based interface

## Historical Note

Drug Wars was originally created by John E. Dell in 1984 for DOS. This version is a faithful recreation of the classic gameplay mechanics with some enhancements.

## License

This is a recreation of a classic game for educational and entertainment purposes.
