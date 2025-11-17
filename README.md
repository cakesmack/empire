# Inverness Empire

A turn-based trading simulation game set in the Inverness area. Build your trading empire by traveling between locations, buying low, selling high, while managing heat, debt, and avoiding police encounters.

## Features

### Core Gameplay
- **6 Unique Locations** - Travel between different areas of Inverness, each with varying danger levels
- **8 Tradeable Items** - Trade various commodities with dynamic pricing
- **Heat System** - Build up heat through illegal trading; higher heat increases police encounter chances
- **Police Encounters** - Face consequences from police raids based on location danger and heat level
- **Property System** - Purchase properties to unlock stash storage at different locations
- **Debt Management** - Start with debt and manage 10% daily interest
- **Dynamic Market** - Prices fluctuate daily with occasional market shocks (30-400% price swings)

### Game Mechanics
- **Pocket Inventory** - Carry up to 100 units in your pockets
- **Stash System** - Store items and cash safely at owned properties
- **Location Restrictions** - Certain items unavailable in specific locations (e.g., hard drugs not available in safer areas)
- **Heat Cooldown** - Heat decreases by 5 points per day
- **Price Shocks** - Random events causing extreme price fluctuations (30% chance per day)
- **Persistent Game State** - All progress saved to Firebase Firestore in real-time

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS (dark theme with custom empire colors)
- **Build Tool**: Vite
- **Backend/Database**: Firebase Firestore
- **Authentication**: Firebase Auth (anonymous sign-in)
- **State Management**: React Hooks + Firebase real-time listeners

## Project Structure

```
inverness-empire/
├── src/
│   ├── App.tsx          # Main application (single-file architecture)
│   ├── main.tsx         # React entry point
│   └── index.css        # Global styles + Tailwind imports
├── public/
├── index.html           # HTML entry point
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite build configuration
├── tailwind.config.js   # Tailwind CSS configuration
└── .env                 # Firebase configuration (not in repo)
```

## Installation

### Prerequisites
- Node.js 18+ and npm/yarn/pnpm
- Firebase project with Firestore enabled

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd inverness-empire
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**

   Create a `.env` file in the root directory with your Firebase credentials:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
   ```

   You can find these values in your Firebase project settings under "Project settings" → "General" → "Your apps".

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   ```

## Game Guide

### Starting Out
- Begin with $2,000 cash and $5,000 debt
- Start in Inverness City Centre
- Debt accrues 10% interest daily - pay it off quickly!

### Trading Strategy
1. **Watch for Price Shocks** - Messages like "Cocaine market has crashed!" indicate major buying/selling opportunities
2. **Manage Inventory Space** - Only 100 units in pockets; buy properties to access larger stash storage
3. **Monitor Heat Levels** - High heat + high danger location = likely police encounter
4. **Location Arbitrage** - Some items aren't available everywhere; travel to find the best deals
5. **Property Investment** - Properties are expensive but provide crucial stash storage

### Heat Management
- Each trade adds heat based on item illegality × quantity
- Heat cooldown: -5 per day
- Police encounter chance = (Location Danger/10 × 20%) + (Heat/100 × 30%)
- Encounters can result in:
  - Minor: Small bribe (10% of cash)
  - Medium: Confiscated items + bribe (20% cash + 50% of one item type)
  - Severe: Major loss (30% cash + 70% of all items)

### Locations
- **Culloden** (Danger: 2) - Safest area, limited selection
- **Crown** (Danger: 3) - Low danger, good for early game
- **Hilton** (Danger: 4) - Moderate danger
- **Inverness City Centre** (Danger: 5) - Central hub
- **Dalneigh** (Danger: 6) - Higher risk, better opportunities
- **Merkinch** (Danger: 7) - Highest danger, full selection

### Items by Illegality
- **Low Risk**: Weed (2), Hash (3), Mushrooms (3)
- **Medium Risk**: Speed (4), Ecstasy (5), LSD (6)
- **High Risk**: Cocaine (7), Heroin (9)

## Architecture Details

### Single-File Architecture
The entire application logic is contained in `App.tsx` for deployment compliance while maintaining modularity through:
- TypeScript interfaces for type safety
- Separate logical functions for game mechanics
- Componentized React UI elements
- Clear separation of concerns

### Data Structure

**GameState** stored at `/artifacts/inverness-empire/users/{userId}/gameState/state`:
```typescript
{
  userId: string;
  day: number;
  cash: number;
  debt: number;
  pocketInventory: { [itemId: string]: number };
  stashCash: number;
  stashInventory: { [itemId: string]: number };
  currentLocation: string;
  locationHeat: { [locationId: string]: number };
  ownedProperties: string[];
  currentPrices: { [itemId: string]: number };
  priceShocks: PriceShock[];
  gameLog: GameLog[];
  lastUpdated: Timestamp;
}
```

### Real-time Synchronization
- Uses Firestore `onSnapshot` listeners for real-time updates
- All state changes written via `updateDoc` for persistence
- Automatic conflict resolution through Firebase
- Ready for multiplayer expansion

## Future Enhancements

The architecture supports easy addition of:
- **Multiplayer Trading** - Shared market prices and trading between players
- **Banking System** - Loans, savings accounts, investments
- **Reputation System** - Unlock new items/locations based on activity
- **NPC System** - Dynamic characters with quests and special deals
- **Combat/Conflict** - Turf wars and rival dealers
- **Advanced Analytics** - Price history charts, profit/loss tracking
- **Cloud Functions** - Server-side validation and anti-cheat

## Development

### Available Scripts
- `npm run dev` - Start development server (http://localhost:5173)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Code Style
- TypeScript strict mode enabled
- Functional React components with Hooks
- Tailwind CSS for styling (no CSS modules)
- ESLint for code quality

## License

This project is for educational and entertainment purposes.

## Credits

Developed as part of the Inverness Empire v2.0 initiative, featuring a complete architectural overhaul for scalability and modern best practices.
