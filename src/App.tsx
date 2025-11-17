import { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// ============================================================================
// TYPESCRIPT INTERFACES & TYPES
// ============================================================================

interface Item {
  id: string;
  name: string;
  basePrice: number;
  variance: number; // Price variation factor (0.5 = ±50%)
  illegality: number; // How much heat trading this generates (1-10)
  unavailableAt?: string[]; // Locations where this item is not available
}

interface Location {
  id: string;
  name: string;
  danger: number; // Base danger level (0-10) affects encounter chance
}

interface Property {
  id: string;
  name: string;
  location: string;
  cost: number;
  stashCapacity: number;
}

interface ItemInventory {
  [itemId: string]: number;
}

interface LocationHeat {
  [locationId: string]: number;
}

interface PriceShock {
  itemId: string;
  multiplier: number;
  message: string;
}

interface GameLog {
  timestamp: Timestamp;
  message: string;
  type: 'info' | 'warning' | 'danger' | 'success';
}

interface GameState {
  userId: string;
  day: number;
  cash: number;
  debt: number;
  pocketInventory: ItemInventory;
  stashCash: number;
  stashInventory: ItemInventory;
  currentLocation: string;
  locationHeat: LocationHeat;
  ownedProperties: string[];
  currentPrices: { [itemId: string]: number };
  priceShocks: PriceShock[];
  gameLog: GameLog[];
  lastUpdated: Timestamp;
}

// ============================================================================
// GAME DATA & CONSTANTS
// ============================================================================

const ITEMS: Item[] = [
  {
    id: 'weed',
    name: 'Weed',
    basePrice: 500,
    variance: 0.4,
    illegality: 2,
  },
  {
    id: 'hash',
    name: 'Hash',
    basePrice: 800,
    variance: 0.5,
    illegality: 3,
  },
  {
    id: 'ecstasy',
    name: 'Ecstasy',
    basePrice: 1500,
    variance: 0.6,
    illegality: 5,
  },
  {
    id: 'cocaine',
    name: 'Cocaine',
    basePrice: 3000,
    variance: 0.7,
    illegality: 7,
    unavailableAt: ['culloden'],
  },
  {
    id: 'heroin',
    name: 'Heroin',
    basePrice: 5000,
    variance: 0.8,
    illegality: 9,
    unavailableAt: ['culloden', 'crown'],
  },
  {
    id: 'lsd',
    name: 'LSD',
    basePrice: 2000,
    variance: 0.6,
    illegality: 6,
  },
  {
    id: 'speed',
    name: 'Speed',
    basePrice: 1200,
    variance: 0.5,
    illegality: 4,
  },
  {
    id: 'mushrooms',
    name: 'Mushrooms',
    basePrice: 600,
    variance: 0.5,
    illegality: 3,
  },
];

const LOCATIONS: Location[] = [
  { id: 'inverness', name: 'Inverness City Centre', danger: 5 },
  { id: 'crown', name: 'Crown', danger: 3 },
  { id: 'merkinch', name: 'Merkinch', danger: 7 },
  { id: 'culloden', name: 'Culloden', danger: 2 },
  { id: 'dalneigh', name: 'Dalneigh', danger: 6 },
  { id: 'hilton', name: 'Hilton', danger: 4 },
];

const PROPERTIES: Property[] = [
  {
    id: 'safe_house_crown',
    name: 'Safe House (Crown)',
    location: 'crown',
    cost: 50000,
    stashCapacity: 200,
  },
  {
    id: 'warehouse_merkinch',
    name: 'Warehouse (Merkinch)',
    location: 'merkinch',
    cost: 150000,
    stashCapacity: 500,
  },
  {
    id: 'flat_dalneigh',
    name: 'Flat (Dalneigh)',
    location: 'dalneigh',
    cost: 80000,
    stashCapacity: 300,
  },
];

const MAX_INVENTORY = 100;
const DEBT_INTEREST_RATE = 0.1;
const HEAT_COOLDOWN_RATE = 5; // Heat reduction per day
const PRICE_SHOCK_CHANCE = 0.3; // 30% chance per day

// Firebase configuration (replace with your actual config)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-project.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789:web:abcdef',
};

const APP_ID = 'inverness-empire';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ============================================================================
// GAME LOGIC FUNCTIONS
// ============================================================================

const generatePrices = (day: number, locationId: string): { [itemId: string]: number } => {
  const prices: { [itemId: string]: number } = {};

  ITEMS.forEach((item) => {
    // Skip if item is unavailable at this location
    if (item.unavailableAt?.includes(locationId)) {
      return;
    }

    // Generate price with variance
    const variance = 1 + (Math.random() * 2 - 1) * item.variance;
    const dayVariance = Math.sin(day * 0.5) * 0.2 + 1; // Cyclical price variation
    prices[item.id] = Math.floor(item.basePrice * variance * dayVariance);
  });

  return prices;
};

const generatePriceShocks = (): PriceShock[] => {
  if (Math.random() > PRICE_SHOCK_CHANCE) {
    return [];
  }

  const shocks: PriceShock[] = [];
  const numShocks = Math.floor(Math.random() * 3) + 1; // 1-3 shocks

  for (let i = 0; i < numShocks; i++) {
    const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
    const isCrash = Math.random() > 0.5;
    const multiplier = isCrash
      ? 0.3 + Math.random() * 0.2 // 30-50% of normal price
      : 2.5 + Math.random() * 1.5; // 250-400% of normal price

    shocks.push({
      itemId: item.id,
      multiplier,
      message: isCrash
        ? `${item.name} market has crashed!`
        : `${item.name} prices have skyrocketed!`,
    });
  }

  return shocks;
};

const applyPriceShocks = (
  prices: { [itemId: string]: number },
  shocks: PriceShock[]
): { [itemId: string]: number } => {
  const newPrices = { ...prices };

  shocks.forEach((shock) => {
    if (newPrices[shock.itemId]) {
      newPrices[shock.itemId] = Math.floor(newPrices[shock.itemId] * shock.multiplier);
    }
  });

  return newPrices;
};

const calculateTotalInventory = (inventory: ItemInventory): number => {
  return Object.values(inventory).reduce((sum, qty) => sum + qty, 0);
};

const calculateInventoryValue = (inventory: ItemInventory): number => {
  return Object.entries(inventory).reduce((sum, [itemId, qty]) => {
    const item = ITEMS.find((i) => i.id === itemId);
    return sum + (item?.basePrice || 0) * qty;
  }, 0);
};

const calculateEncounterChance = (locationDanger: number, heat: number): number => {
  // Base chance from location danger (0-10) -> 0-20%
  // Heat adds additional risk (0-100) -> 0-30%
  const baseChance = (locationDanger / 10) * 0.2;
  const heatChance = (heat / 100) * 0.3;
  return Math.min(baseChance + heatChance, 0.8); // Max 80% chance
};

const handlePoliceEncounter = (
  gameState: GameState
): { message: string; cashLost: number; itemsLost: ItemInventory } => {
  const itemsLost: ItemInventory = {};
  let cashLost = 0;

  // Determine severity (0-1)
  const severity = Math.random();

  if (severity < 0.3) {
    // Minor: Small bribe
    cashLost = Math.floor(gameState.cash * 0.1);
    return {
      message: `You paid a ${cashLost} bribe to avoid arrest.`,
      cashLost,
      itemsLost,
    };
  } else if (severity < 0.7) {
    // Medium: Confiscate some inventory + bribe
    cashLost = Math.floor(gameState.cash * 0.2);
    const inventoryKeys = Object.keys(gameState.pocketInventory);
    if (inventoryKeys.length > 0) {
      const confiscatedItem =
        inventoryKeys[Math.floor(Math.random() * inventoryKeys.length)];
      const confiscatedQty = Math.ceil(gameState.pocketInventory[confiscatedItem] * 0.5);
      itemsLost[confiscatedItem] = confiscatedQty;
    }
    return {
      message: `Police confiscated some of your stash and you paid a ${cashLost} bribe!`,
      cashLost,
      itemsLost,
    };
  } else {
    // Severe: Major confiscation
    cashLost = Math.floor(gameState.cash * 0.3);
    // Lose 70% of all inventory
    Object.entries(gameState.pocketInventory).forEach(([itemId, qty]) => {
      itemsLost[itemId] = Math.ceil(qty * 0.7);
    });
    return {
      message: `Major police raid! They confiscated most of your inventory and fined you ${cashLost}!`,
      cashLost,
      itemsLost,
    };
  }
};

const cooldownHeat = (locationHeat: LocationHeat): LocationHeat => {
  const newHeat: LocationHeat = {};
  Object.entries(locationHeat).forEach(([locationId, heat]) => {
    newHeat[locationId] = Math.max(0, heat - HEAT_COOLDOWN_RATE);
  });
  return newHeat;
};

const addGameLog = (
  logs: GameLog[],
  message: string,
  type: GameLog['type'] = 'info'
): GameLog[] => {
  const newLog: GameLog = {
    timestamp: Timestamp.now(),
    message,
    type,
  };
  return [newLog, ...logs].slice(0, 50); // Keep last 50 logs
};

// ============================================================================
// FIREBASE HOOKS
// ============================================================================

const useAuth = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        // Sign in anonymously if no user
        try {
          const result = await signInAnonymously(auth);
          setUserId(result.user.uid);
        } catch (error) {
          console.error('Failed to sign in anonymously:', error);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { userId, loading };
};

const useGameState = (userId: string | null) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const docRef = doc(db, `artifacts/${APP_ID}/users/${userId}/gameState/state`);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setGameState(snapshot.data() as GameState);
        } else {
          // Initialize new game
          const initialState: GameState = {
            userId,
            day: 1,
            cash: 2000,
            debt: 5000,
            pocketInventory: {},
            stashCash: 0,
            stashInventory: {},
            currentLocation: 'inverness',
            locationHeat: {},
            ownedProperties: [],
            currentPrices: generatePrices(1, 'inverness'),
            priceShocks: [],
            gameLog: [],
            lastUpdated: Timestamp.now(),
          };
          setDoc(docRef, initialState);
          setGameState(initialState);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error loading game state:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const updateGameState = useCallback(
    async (updates: Partial<GameState>) => {
      if (!userId || !gameState) return;

      const docRef = doc(db, `artifacts/${APP_ID}/users/${userId}/gameState/state`);
      await updateDoc(docRef, {
        ...updates,
        lastUpdated: Timestamp.now(),
      });
    },
    [userId, gameState]
  );

  return { gameState, loading, updateGameState };
};

// ============================================================================
// REACT COMPONENTS
// ============================================================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-empire-darker border-2 border-empire-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-empire-border">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'danger' | 'success' | 'secondary';
  disabled?: boolean;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({
  onClick,
  children,
  variant = 'primary',
  disabled = false,
  className = '',
}) => {
  const baseClasses = 'px-4 py-2 rounded font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    danger: 'bg-empire-danger hover:bg-red-600 text-white',
    success: 'bg-empire-accent hover:bg-green-600 text-white',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

interface StatusBarProps {
  gameState: GameState;
}

const StatusBar: React.FC<StatusBarProps> = ({ gameState }) => {
  const currentLocation = LOCATIONS.find((l) => l.id === gameState.currentLocation);
  const pocketSpace = calculateTotalInventory(gameState.pocketInventory);
  const maxStash = gameState.ownedProperties.reduce((sum, propId) => {
    const prop = PROPERTIES.find((p) => p.id === propId);
    return sum + (prop?.stashCapacity || 0);
  }, 0);
  const stashSpace = calculateTotalInventory(gameState.stashInventory);

  return (
    <div className="bg-empire-darker border-2 border-empire-border rounded-lg p-4 mb-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-gray-400 text-sm">Day</div>
          <div className="text-xl font-bold">{gameState.day}</div>
        </div>
        <div>
          <div className="text-gray-400 text-sm">Location</div>
          <div className="text-xl font-bold">{currentLocation?.name}</div>
        </div>
        <div>
          <div className="text-gray-400 text-sm">Cash</div>
          <div className="text-xl font-bold text-empire-accent">${gameState.cash.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-gray-400 text-sm">Debt</div>
          <div className="text-xl font-bold text-empire-danger">${gameState.debt.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-gray-400 text-sm">Pockets</div>
          <div className="text-xl font-bold">{pocketSpace}/{MAX_INVENTORY}</div>
        </div>
        <div>
          <div className="text-gray-400 text-sm">Stash</div>
          <div className="text-xl font-bold">{stashSpace}/{maxStash || 0}</div>
        </div>
        <div>
          <div className="text-gray-400 text-sm">Stash Cash</div>
          <div className="text-xl font-bold">${gameState.stashCash.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-gray-400 text-sm">Heat</div>
          <div className="text-xl font-bold text-empire-warning">
            {Math.floor(gameState.locationHeat[gameState.currentLocation] || 0)}%
          </div>
        </div>
      </div>
    </div>
  );
};

interface MarketProps {
  gameState: GameState;
  updateGameState: (updates: Partial<GameState>) => void;
}

const Market: React.FC<MarketProps> = ({ gameState, updateGameState }) => {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [action, setAction] = useState<'buy' | 'sell'>('buy');

  const handleTrade = () => {
    if (!selectedItem) return;

    const item = ITEMS.find((i) => i.id === selectedItem);
    if (!item) return;

    const price = gameState.currentPrices[selectedItem] || 0;
    const currentInventory = { ...gameState.pocketInventory };
    const currentHeat = { ...gameState.locationHeat };

    if (action === 'buy') {
      const totalCost = price * quantity;
      if (totalCost > gameState.cash) {
        alert('Not enough cash!');
        return;
      }

      const currentSpace = calculateTotalInventory(currentInventory);
      if (currentSpace + quantity > MAX_INVENTORY) {
        alert('Not enough pocket space!');
        return;
      }

      currentInventory[selectedItem] = (currentInventory[selectedItem] || 0) + quantity;
      const newCash = gameState.cash - totalCost;
      const heatIncrease = item.illegality * quantity * 0.5;
      currentHeat[gameState.currentLocation] =
        (currentHeat[gameState.currentLocation] || 0) + heatIncrease;

      const newLog = addGameLog(
        gameState.gameLog,
        `Bought ${quantity}x ${item.name} for $${totalCost.toLocaleString()}`,
        'success'
      );

      updateGameState({
        cash: newCash,
        pocketInventory: currentInventory,
        locationHeat: currentHeat,
        gameLog: newLog,
      });
    } else {
      // Sell
      const currentQty = currentInventory[selectedItem] || 0;
      if (currentQty < quantity) {
        alert('Not enough inventory!');
        return;
      }

      const totalEarnings = price * quantity;
      currentInventory[selectedItem] = currentQty - quantity;
      if (currentInventory[selectedItem] === 0) {
        delete currentInventory[selectedItem];
      }

      const newCash = gameState.cash + totalEarnings;
      const heatIncrease = item.illegality * quantity * 0.3;
      currentHeat[gameState.currentLocation] =
        (currentHeat[gameState.currentLocation] || 0) + heatIncrease;

      const newLog = addGameLog(
        gameState.gameLog,
        `Sold ${quantity}x ${item.name} for $${totalEarnings.toLocaleString()}`,
        'success'
      );

      updateGameState({
        cash: newCash,
        pocketInventory: currentInventory,
        locationHeat: currentHeat,
        gameLog: newLog,
      });
    }

    setQuantity(1);
  };

  const availableItems = ITEMS.filter(
    (item) =>
      !item.unavailableAt?.includes(gameState.currentLocation) &&
      gameState.currentPrices[item.id] !== undefined
  );

  return (
    <div className="bg-empire-darker border-2 border-empire-border rounded-lg p-4">
      <h2 className="text-2xl font-bold mb-4">Market</h2>

      {/* Price Shocks Alert */}
      {gameState.priceShocks.length > 0 && (
        <div className="mb-4 p-3 bg-empire-warning bg-opacity-20 border border-empire-warning rounded">
          <div className="font-bold mb-1">⚠️ Market Alert!</div>
          {gameState.priceShocks.map((shock, idx) => (
            <div key={idx} className="text-sm">{shock.message}</div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {availableItems.map((item) => {
          const price = gameState.currentPrices[item.id] || 0;
          const inPocket = gameState.pocketInventory[item.id] || 0;
          const isShocked = gameState.priceShocks.some((s) => s.itemId === item.id);

          return (
            <div
              key={item.id}
              className={`p-3 border rounded cursor-pointer transition-colors ${
                selectedItem === item.id
                  ? 'border-empire-accent bg-empire-accent bg-opacity-10'
                  : 'border-empire-border hover:border-gray-600'
              } ${isShocked ? 'ring-2 ring-empire-warning' : ''}`}
              onClick={() => setSelectedItem(item.id)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold">{item.name}</div>
                  <div className="text-empire-accent">${price.toLocaleString()}</div>
                  {inPocket > 0 && (
                    <div className="text-sm text-gray-400">Have: {inPocket}</div>
                  )}
                </div>
                <div className="text-xs text-gray-500">Heat: {item.illegality}/10</div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedItem && (
        <div className="border-t border-empire-border pt-4">
          <div className="flex gap-2 mb-3">
            <Button
              onClick={() => setAction('buy')}
              variant={action === 'buy' ? 'success' : 'secondary'}
            >
              Buy
            </Button>
            <Button
              onClick={() => setAction('sell')}
              variant={action === 'sell' ? 'danger' : 'secondary'}
            >
              Sell
            </Button>
          </div>

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-empire-dark border border-empire-border rounded px-3 py-2 text-white"
              />
            </div>
            <Button onClick={handleTrade} variant={action === 'buy' ? 'success' : 'danger'}>
              {action === 'buy' ? 'Buy' : 'Sell'} for $
              {((gameState.currentPrices[selectedItem] || 0) * quantity).toLocaleString()}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

interface TravelProps {
  gameState: GameState;
  updateGameState: (updates: Partial<GameState>) => void;
  onEncounter: (encounterData: ReturnType<typeof handlePoliceEncounter>) => void;
}

const Travel: React.FC<TravelProps> = ({ gameState, updateGameState, onEncounter }) => {
  const handleTravel = (locationId: string) => {
    if (locationId === gameState.currentLocation) return;

    const location = LOCATIONS.find((l) => l.id === locationId);
    if (!location) return;

    // Generate new prices for new location
    const newPrices = generatePrices(gameState.day + 1, locationId);

    // Check for price shocks
    const priceShocks = generatePriceShocks();
    const finalPrices = applyPriceShocks(newPrices, priceShocks);

    // Check for police encounter at OLD location before leaving
    const oldHeat = gameState.locationHeat[gameState.currentLocation] || 0;
    const oldLocation = LOCATIONS.find((l) => l.id === gameState.currentLocation);
    const encounterChance = calculateEncounterChance(oldLocation?.danger || 0, oldHeat);
    const hasEncounter = Math.random() < encounterChance;

    if (hasEncounter) {
      const encounter = handlePoliceEncounter(gameState);
      onEncounter(encounter);

      // Apply encounter consequences
      const newCash = Math.max(0, gameState.cash - encounter.cashLost);
      const newInventory = { ...gameState.pocketInventory };
      Object.entries(encounter.itemsLost).forEach(([itemId, qty]) => {
        newInventory[itemId] = Math.max(0, (newInventory[itemId] || 0) - qty);
        if (newInventory[itemId] === 0) delete newInventory[itemId];
      });

      // Reset heat at old location
      const newLocationHeat = { ...gameState.locationHeat };
      newLocationHeat[gameState.currentLocation] = 0;

      // Apply debt interest
      const newDebt = Math.floor(gameState.debt * (1 + DEBT_INTEREST_RATE));

      // Cooldown heat
      const cooledHeat = cooldownHeat(newLocationHeat);

      const newLog = addGameLog(
        gameState.gameLog,
        `Traveled to ${location.name}. ${encounter.message}`,
        'danger'
      );

      updateGameState({
        currentLocation: locationId,
        day: gameState.day + 1,
        cash: newCash,
        debt: newDebt,
        pocketInventory: newInventory,
        currentPrices: finalPrices,
        priceShocks,
        locationHeat: cooledHeat,
        gameLog: newLog,
      });
    } else {
      // No encounter, normal travel
      const newDebt = Math.floor(gameState.debt * (1 + DEBT_INTEREST_RATE));
      const cooledHeat = cooldownHeat(gameState.locationHeat);

      const newLog = addGameLog(
        gameState.gameLog,
        `Traveled to ${location.name}`,
        'info'
      );

      updateGameState({
        currentLocation: locationId,
        day: gameState.day + 1,
        debt: newDebt,
        currentPrices: finalPrices,
        priceShocks,
        locationHeat: cooledHeat,
        gameLog: newLog,
      });
    }
  };

  return (
    <div className="bg-empire-darker border-2 border-empire-border rounded-lg p-4">
      <h2 className="text-2xl font-bold mb-4">Travel</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {LOCATIONS.map((location) => {
          const isCurrent = location.id === gameState.currentLocation;
          const heat = gameState.locationHeat[location.id] || 0;
          const encounterChance = calculateEncounterChance(location.danger, heat);
          const hasProperty = gameState.ownedProperties.some((propId) => {
            const prop = PROPERTIES.find((p) => p.id === propId);
            return prop?.location === location.id;
          });

          return (
            <button
              key={location.id}
              onClick={() => handleTravel(location.id)}
              disabled={isCurrent}
              className={`p-3 border rounded text-left transition-colors ${
                isCurrent
                  ? 'border-empire-accent bg-empire-accent bg-opacity-20 cursor-not-allowed'
                  : 'border-empire-border hover:border-gray-600'
              }`}
            >
              <div className="font-bold flex items-center gap-2">
                {location.name}
                {hasProperty && <span className="text-empire-accent text-sm">🏠</span>}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                Danger: {location.danger}/10
              </div>
              {!isCurrent && heat > 0 && (
                <div className="text-sm text-empire-warning mt-1">
                  Heat: {Math.floor(heat)}% | Encounter: {Math.floor(encounterChance * 100)}%
                </div>
              )}
              {isCurrent && (
                <div className="text-sm text-empire-accent mt-1">Current Location</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface StashProps {
  gameState: GameState;
  updateGameState: (updates: Partial<GameState>) => void;
}

const Stash: React.FC<StashProps> = ({ gameState, updateGameState }) => {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [action, setAction] = useState<'deposit' | 'withdraw'>('deposit');
  const [cashAmount, setCashAmount] = useState<number>(0);

  const propertyAtLocation = gameState.ownedProperties.find((propId) => {
    const prop = PROPERTIES.find((p) => p.id === propId);
    return prop?.location === gameState.currentLocation;
  });

  if (!propertyAtLocation) {
    return (
      <div className="bg-empire-darker border-2 border-empire-border rounded-lg p-4">
        <h2 className="text-2xl font-bold mb-4">Stash</h2>
        <p className="text-gray-400">You don't own a property at this location.</p>
      </div>
    );
  }

  const property = PROPERTIES.find((p) => p.id === propertyAtLocation);
  const maxStashSpace = property?.stashCapacity || 0;
  const currentStashSpace = calculateTotalInventory(gameState.stashInventory);

  const handleItemTransfer = () => {
    if (!selectedItem) return;

    const newPocketInventory = { ...gameState.pocketInventory };
    const newStashInventory = { ...gameState.stashInventory };

    if (action === 'deposit') {
      const pocketQty = newPocketInventory[selectedItem] || 0;
      if (pocketQty < quantity) {
        alert('Not enough in pockets!');
        return;
      }
      if (currentStashSpace + quantity > maxStashSpace) {
        alert('Stash is full!');
        return;
      }

      newPocketInventory[selectedItem] = pocketQty - quantity;
      if (newPocketInventory[selectedItem] === 0) delete newPocketInventory[selectedItem];
      newStashInventory[selectedItem] = (newStashInventory[selectedItem] || 0) + quantity;

      const newLog = addGameLog(
        gameState.gameLog,
        `Deposited ${quantity}x ${ITEMS.find((i) => i.id === selectedItem)?.name} to stash`,
        'info'
      );

      updateGameState({
        pocketInventory: newPocketInventory,
        stashInventory: newStashInventory,
        gameLog: newLog,
      });
    } else {
      // Withdraw
      const stashQty = newStashInventory[selectedItem] || 0;
      if (stashQty < quantity) {
        alert('Not enough in stash!');
        return;
      }
      const pocketSpace = calculateTotalInventory(newPocketInventory);
      if (pocketSpace + quantity > MAX_INVENTORY) {
        alert('Pockets are full!');
        return;
      }

      newStashInventory[selectedItem] = stashQty - quantity;
      if (newStashInventory[selectedItem] === 0) delete newStashInventory[selectedItem];
      newPocketInventory[selectedItem] = (newPocketInventory[selectedItem] || 0) + quantity;

      const newLog = addGameLog(
        gameState.gameLog,
        `Withdrew ${quantity}x ${ITEMS.find((i) => i.id === selectedItem)?.name} from stash`,
        'info'
      );

      updateGameState({
        pocketInventory: newPocketInventory,
        stashInventory: newStashInventory,
        gameLog: newLog,
      });
    }

    setQuantity(1);
  };

  const handleCashTransfer = (depositCash: boolean) => {
    if (depositCash) {
      if (cashAmount > gameState.cash) {
        alert('Not enough cash!');
        return;
      }

      const newLog = addGameLog(
        gameState.gameLog,
        `Deposited $${cashAmount.toLocaleString()} to stash`,
        'info'
      );

      updateGameState({
        cash: gameState.cash - cashAmount,
        stashCash: gameState.stashCash + cashAmount,
        gameLog: newLog,
      });
    } else {
      if (cashAmount > gameState.stashCash) {
        alert('Not enough cash in stash!');
        return;
      }

      const newLog = addGameLog(
        gameState.gameLog,
        `Withdrew $${cashAmount.toLocaleString()} from stash`,
        'info'
      );

      updateGameState({
        cash: gameState.cash + cashAmount,
        stashCash: gameState.stashCash - cashAmount,
        gameLog: newLog,
      });
    }

    setCashAmount(0);
  };

  const allItems = new Set([
    ...Object.keys(gameState.pocketInventory),
    ...Object.keys(gameState.stashInventory),
  ]);

  return (
    <div className="bg-empire-darker border-2 border-empire-border rounded-lg p-4">
      <h2 className="text-2xl font-bold mb-4">
        Stash - {property?.name}
      </h2>
      <div className="text-sm text-gray-400 mb-4">
        Space: {currentStashSpace}/{maxStashSpace}
      </div>

      {/* Cash Transfer */}
      <div className="mb-6 p-3 border border-empire-border rounded">
        <h3 className="font-bold mb-2">Cash Transfer</h3>
        <div className="flex gap-2 items-end mb-2">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-1">Amount</label>
            <input
              type="number"
              min="0"
              value={cashAmount}
              onChange={(e) => setCashAmount(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full bg-empire-dark border border-empire-border rounded px-3 py-2 text-white"
            />
          </div>
          <Button onClick={() => handleCashTransfer(true)} variant="success">
            Deposit
          </Button>
          <Button onClick={() => handleCashTransfer(false)} variant="danger">
            Withdraw
          </Button>
        </div>
      </div>

      {/* Item Transfer */}
      <div className="mb-4">
        <h3 className="font-bold mb-2">Items</h3>
        <div className="flex gap-2 mb-3">
          <Button
            onClick={() => setAction('deposit')}
            variant={action === 'deposit' ? 'success' : 'secondary'}
          >
            Deposit to Stash
          </Button>
          <Button
            onClick={() => setAction('withdraw')}
            variant={action === 'withdraw' ? 'danger' : 'secondary'}
          >
            Withdraw from Stash
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
          {Array.from(allItems).map((itemId) => {
            const item = ITEMS.find((i) => i.id === itemId);
            const inPocket = gameState.pocketInventory[itemId] || 0;
            const inStash = gameState.stashInventory[itemId] || 0;

            return (
              <div
                key={itemId}
                className={`p-2 border rounded cursor-pointer transition-colors ${
                  selectedItem === itemId
                    ? 'border-empire-accent bg-empire-accent bg-opacity-10'
                    : 'border-empire-border hover:border-gray-600'
                }`}
                onClick={() => setSelectedItem(itemId)}
              >
                <div className="font-bold">{item?.name}</div>
                <div className="text-sm text-gray-400">
                  Pocket: {inPocket} | Stash: {inStash}
                </div>
              </div>
            );
          })}
        </div>

        {selectedItem && (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-empire-dark border border-empire-border rounded px-3 py-2 text-white"
              />
            </div>
            <Button
              onClick={handleItemTransfer}
              variant={action === 'deposit' ? 'success' : 'danger'}
            >
              {action === 'deposit' ? 'Deposit' : 'Withdraw'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

interface PropertiesProps {
  gameState: GameState;
  updateGameState: (updates: Partial<GameState>) => void;
}

const Properties: React.FC<PropertiesProps> = ({ gameState, updateGameState }) => {
  const handleBuyProperty = (propertyId: string) => {
    const property = PROPERTIES.find((p) => p.id === propertyId);
    if (!property) return;

    if (gameState.cash < property.cost) {
      alert('Not enough cash!');
      return;
    }

    if (gameState.ownedProperties.includes(propertyId)) {
      alert('You already own this property!');
      return;
    }

    const newLog = addGameLog(
      gameState.gameLog,
      `Purchased ${property.name} for $${property.cost.toLocaleString()}`,
      'success'
    );

    updateGameState({
      cash: gameState.cash - property.cost,
      ownedProperties: [...gameState.ownedProperties, propertyId],
      gameLog: newLog,
    });
  };

  return (
    <div className="bg-empire-darker border-2 border-empire-border rounded-lg p-4">
      <h2 className="text-2xl font-bold mb-4">Properties</h2>

      <div className="grid grid-cols-1 gap-3">
        {PROPERTIES.map((property) => {
          const isOwned = gameState.ownedProperties.includes(property.id);
          const location = LOCATIONS.find((l) => l.id === property.location);

          return (
            <div
              key={property.id}
              className={`p-3 border rounded ${
                isOwned
                  ? 'border-empire-accent bg-empire-accent bg-opacity-10'
                  : 'border-empire-border'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold">{property.name}</div>
                  <div className="text-sm text-gray-400">{location?.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-empire-accent font-bold">
                    ${property.cost.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-400">
                    Stash: {property.stashCapacity}
                  </div>
                </div>
              </div>

              {isOwned ? (
                <div className="text-empire-accent text-sm">✓ Owned</div>
              ) : (
                <Button
                  onClick={() => handleBuyProperty(property.id)}
                  variant="success"
                  disabled={gameState.cash < property.cost}
                >
                  Buy Property
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface DebtProps {
  gameState: GameState;
  updateGameState: (updates: Partial<GameState>) => void;
}

const Debt: React.FC<DebtProps> = ({ gameState, updateGameState }) => {
  const [payAmount, setPayAmount] = useState<number>(0);

  const handlePayDebt = () => {
    if (payAmount <= 0) return;
    if (payAmount > gameState.cash) {
      alert('Not enough cash!');
      return;
    }

    const actualPayment = Math.min(payAmount, gameState.debt);

    const newLog = addGameLog(
      gameState.gameLog,
      `Paid $${actualPayment.toLocaleString()} towards debt`,
      'success'
    );

    updateGameState({
      cash: gameState.cash - actualPayment,
      debt: gameState.debt - actualPayment,
      gameLog: newLog,
    });

    setPayAmount(0);
  };

  return (
    <div className="bg-empire-darker border-2 border-empire-border rounded-lg p-4">
      <h2 className="text-2xl font-bold mb-4">Debt Management</h2>

      <div className="mb-4">
        <div className="text-gray-400 text-sm">Current Debt</div>
        <div className="text-3xl font-bold text-empire-danger">
          ${gameState.debt.toLocaleString()}
        </div>
        <div className="text-sm text-gray-400 mt-1">
          Interest Rate: {(DEBT_INTEREST_RATE * 100).toFixed(0)}% per day
        </div>
      </div>

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-sm text-gray-400 mb-1">Payment Amount</label>
          <input
            type="number"
            min="0"
            max={Math.min(gameState.cash, gameState.debt)}
            value={payAmount}
            onChange={(e) => setPayAmount(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full bg-empire-dark border border-empire-border rounded px-3 py-2 text-white"
          />
        </div>
        <Button onClick={handlePayDebt} variant="success" disabled={payAmount <= 0}>
          Pay Debt
        </Button>
        <Button
          onClick={() => setPayAmount(Math.min(gameState.cash, gameState.debt))}
          variant="secondary"
        >
          Max
        </Button>
      </div>
    </div>
  );
};

interface GameLogProps {
  gameLog: GameLog[];
}

const GameLogComponent: React.FC<GameLogProps> = ({ gameLog }) => {
  const typeColors = {
    info: 'text-gray-400',
    success: 'text-empire-accent',
    warning: 'text-empire-warning',
    danger: 'text-empire-danger',
  };

  return (
    <div className="bg-empire-darker border-2 border-empire-border rounded-lg p-4">
      <h2 className="text-2xl font-bold mb-4">Game Log</h2>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {gameLog.length === 0 ? (
          <div className="text-gray-400 text-sm">No activity yet...</div>
        ) : (
          gameLog.map((log, idx) => (
            <div key={idx} className="text-sm">
              <span className="text-gray-500">
                {log.timestamp.toDate().toLocaleTimeString()}
              </span>
              {' - '}
              <span className={typeColors[log.type]}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

function App() {
  const { userId, loading: authLoading } = useAuth();
  const { gameState, loading: gameLoading, updateGameState } = useGameState(userId);
  const [activeTab, setActiveTab] = useState<string>('market');
  const [encounterModalOpen, setEncounterModalOpen] = useState(false);
  const [encounterData, setEncounterData] = useState<ReturnType<typeof handlePoliceEncounter> | null>(null);

  const handleEncounter = (data: ReturnType<typeof handlePoliceEncounter>) => {
    setEncounterData(data);
    setEncounterModalOpen(true);
  };

  if (authLoading || gameLoading) {
    return (
      <div className="min-h-screen bg-empire-dark flex items-center justify-center">
        <div className="text-2xl font-bold">Loading Inverness Empire...</div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-empire-dark flex items-center justify-center">
        <div className="text-2xl font-bold text-empire-danger">
          Failed to load game state
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'market', label: 'Market' },
    { id: 'travel', label: 'Travel' },
    { id: 'stash', label: 'Stash' },
    { id: 'properties', label: 'Properties' },
    { id: 'debt', label: 'Debt' },
    { id: 'log', label: 'Log' },
  ];

  return (
    <div className="min-h-screen bg-empire-dark p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold mb-2">Inverness Empire</h1>
          <p className="text-gray-400">Build your trading empire in the Highlands</p>
        </div>

        {/* Status Bar */}
        <StatusBar gameState={gameState} />

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-empire-accent text-white'
                  : 'bg-empire-darker text-gray-400 hover:text-white border border-empire-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'market' && (
            <Market gameState={gameState} updateGameState={updateGameState} />
          )}
          {activeTab === 'travel' && (
            <Travel
              gameState={gameState}
              updateGameState={updateGameState}
              onEncounter={handleEncounter}
            />
          )}
          {activeTab === 'stash' && (
            <Stash gameState={gameState} updateGameState={updateGameState} />
          )}
          {activeTab === 'properties' && (
            <Properties gameState={gameState} updateGameState={updateGameState} />
          )}
          {activeTab === 'debt' && (
            <Debt gameState={gameState} updateGameState={updateGameState} />
          )}
          {activeTab === 'log' && <GameLogComponent gameLog={gameState.gameLog} />}
        </div>

        {/* Encounter Modal */}
        <Modal
          isOpen={encounterModalOpen}
          onClose={() => setEncounterModalOpen(false)}
          title="🚨 Police Encounter!"
        >
          {encounterData && (
            <div>
              <p className="text-lg mb-4">{encounterData.message}</p>
              {encounterData.cashLost > 0 && (
                <div className="text-empire-danger mb-2">
                  Cash Lost: ${encounterData.cashLost.toLocaleString()}
                </div>
              )}
              {Object.keys(encounterData.itemsLost).length > 0 && (
                <div className="mb-4">
                  <div className="font-bold mb-1">Items Confiscated:</div>
                  {Object.entries(encounterData.itemsLost).map(([itemId, qty]) => {
                    const item = ITEMS.find((i) => i.id === itemId);
                    return (
                      <div key={itemId} className="text-sm text-gray-400">
                        {item?.name}: {qty} units
                      </div>
                    );
                  })}
                </div>
              )}
              <Button onClick={() => setEncounterModalOpen(false)} variant="danger">
                Continue
              </Button>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}

export default App;
