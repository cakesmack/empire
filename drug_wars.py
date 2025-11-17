#!/usr/bin/env python3
"""
Drug Wars - A Classic Economic Simulation Game
Travel between cities, buy low, sell high, and make your fortune!
"""

import random
import sys
from typing import Dict, List, Tuple


class DrugWars:
    def __init__(self):
        self.cities = ["Bronx", "Ghetto", "Central Park", "Manhattan", "Coney Island", "Brooklyn"]

        self.drugs = {
            "Acid": {"min": 1000, "max": 4500},
            "Cocaine": {"min": 15000, "max": 30000},
            "Hashish": {"min": 500, "max": 1400},
            "Heroin": {"min": 5500, "max": 14000},
            "Ludes": {"min": 10, "max": 60},
            "MDA": {"min": 1500, "max": 4400},
            "Opium": {"min": 500, "max": 1300},
            "PCP": {"min": 1000, "max": 2500},
            "Peyote": {"min": 200, "max": 700},
            "Shrooms": {"min": 600, "max": 1300},
            "Speed": {"min": 90, "max": 250},
            "Weed": {"min": 300, "max": 900}
        }

        self.day = 1
        self.max_days = 30
        self.cash = 2000
        self.debt = 5500
        self.bank = 0
        self.inventory = {}
        self.current_city = random.choice(self.cities)
        self.trench_coat_space = 100
        self.current_prices = {}

        self.generate_prices()

    def generate_prices(self):
        """Generate random prices for drugs in current city."""
        self.current_prices = {}

        # Randomly select 5-8 drugs to be available
        available_drugs = random.sample(list(self.drugs.keys()), random.randint(5, 8))

        for drug in available_drugs:
            base_min = self.drugs[drug]["min"]
            base_max = self.drugs[drug]["max"]

            # Add price variation
            variation = random.uniform(0.7, 1.3)
            price = int(random.randint(base_min, base_max) * variation)
            self.current_prices[drug] = price

        # Random events that drastically change prices
        if random.random() < 0.15:
            special_drug = random.choice(list(self.current_prices.keys()))
            event_type = random.choice(["cheap", "expensive"])

            if event_type == "cheap":
                self.current_prices[special_drug] = int(self.current_prices[special_drug] * 0.3)
                print(f"\n*** Addicts are buying {special_drug} at rock-bottom prices! ***\n")
            else:
                self.current_prices[special_drug] = int(self.current_prices[special_drug] * 3)
                print(f"\n*** The market for {special_drug} has gone through the roof! ***\n")

    def get_inventory_space_used(self) -> int:
        """Calculate total inventory space used."""
        return sum(self.inventory.values())

    def get_inventory_space_available(self) -> int:
        """Calculate available inventory space."""
        return self.trench_coat_space - self.get_inventory_space_used()

    def display_status(self):
        """Display current game status."""
        print("\n" + "=" * 60)
        print(f"Day {self.day} of {self.max_days} | Location: {self.current_city}")
        print(f"Cash: ${self.cash:,}")
        if self.debt > 0:
            print(f"Debt: ${self.debt:,}")
        if self.bank > 0:
            print(f"Bank: ${self.bank:,}")
        print(f"Inventory Space: {self.get_inventory_space_used()}/{self.trench_coat_space}")
        print("=" * 60)

    def display_prices(self):
        """Display current drug prices."""
        print("\nCurrent Prices:")
        print("-" * 40)
        for i, (drug, price) in enumerate(sorted(self.current_prices.items()), 1):
            inventory_amount = self.inventory.get(drug, 0)
            inv_str = f" (Have: {inventory_amount})" if inventory_amount > 0 else ""
            print(f"{i:2}. {drug:12} ${price:,}{inv_str}")
        print("-" * 40)

    def display_inventory(self):
        """Display player's inventory."""
        if not self.inventory:
            print("\nYour trench coat is empty!")
            return

        print("\nYour Inventory:")
        print("-" * 40)
        for drug, amount in sorted(self.inventory.items()):
            if amount > 0:
                print(f"{drug:12} x {amount}")
        print("-" * 40)

    def random_event(self):
        """Trigger random events."""
        event_chance = random.random()

        # Officer Hardass appears
        if event_chance < 0.15:
            print("\n*** Officer Hardass and his dogs are coming! ***")
            if self.get_inventory_space_used() > 0:
                print("You need to dump your stash!")
                dump_drug = random.choice(list(self.inventory.keys()))
                dump_amount = self.inventory[dump_drug]
                self.inventory[dump_drug] = 0
                print(f"You dumped {dump_amount} units of {dump_drug}!")
                # Clean up empty entries
                self.inventory = {k: v for k, v in self.inventory.items() if v > 0}
            else:
                print("Good thing you're clean!")

        # Find drugs
        elif event_chance < 0.25:
            if self.get_inventory_space_available() > 0:
                found_drug = random.choice(list(self.drugs.keys()))
                found_amount = random.randint(1, min(20, self.get_inventory_space_available()))
                self.inventory[found_drug] = self.inventory.get(found_drug, 0) + found_amount
                print(f"\n*** You found {found_amount} units of {found_drug} on a dead dude! ***")

        # Mugged
        elif event_chance < 0.30:
            if self.cash > 0:
                stolen = int(self.cash * random.uniform(0.1, 0.3))
                self.cash -= stolen
                print(f"\n*** You got mugged! Lost ${stolen:,}! ***")

    def buy_drug(self):
        """Handle buying drugs."""
        self.display_prices()

        try:
            choice = input("\nWhat do you want to buy? (name or number, or 'cancel'): ").strip()

            if choice.lower() == 'cancel':
                return

            # Handle numeric choice
            if choice.isdigit():
                drug_list = sorted(self.current_prices.keys())
                idx = int(choice) - 1
                if 0 <= idx < len(drug_list):
                    drug = drug_list[idx]
                else:
                    print("Invalid selection!")
                    return
            else:
                # Handle name choice
                drug = None
                for d in self.current_prices.keys():
                    if d.lower() == choice.lower():
                        drug = d
                        break

                if not drug:
                    print("That drug isn't available here!")
                    return

            price = self.current_prices[drug]
            max_can_afford = self.cash // price
            max_can_carry = self.get_inventory_space_available()
            max_can_buy = min(max_can_afford, max_can_carry)

            if max_can_buy == 0:
                if max_can_afford == 0:
                    print("You can't afford any!")
                else:
                    print("You don't have space in your trench coat!")
                return

            amount_str = input(f"How many? (max: {max_can_buy}): ").strip()

            if not amount_str.isdigit():
                print("Invalid amount!")
                return

            amount = int(amount_str)

            if amount <= 0 or amount > max_can_buy:
                print(f"You can only buy up to {max_can_buy}!")
                return

            total_cost = amount * price
            self.cash -= total_cost
            self.inventory[drug] = self.inventory.get(drug, 0) + amount

            print(f"\nBought {amount} units of {drug} for ${total_cost:,}")

        except (ValueError, KeyboardInterrupt):
            print("\nCancelled.")

    def sell_drug(self):
        """Handle selling drugs."""
        if not self.inventory:
            print("\nYou don't have anything to sell!")
            return

        self.display_inventory()
        self.display_prices()

        try:
            choice = input("\nWhat do you want to sell? (name or 'cancel'): ").strip()

            if choice.lower() == 'cancel':
                return

            drug = None
            for d in self.inventory.keys():
                if d.lower() == choice.lower():
                    drug = d
                    break

            if not drug or self.inventory.get(drug, 0) == 0:
                print("You don't have that!")
                return

            if drug not in self.current_prices:
                print(f"Nobody's buying {drug} here!")
                return

            have = self.inventory[drug]
            price = self.current_prices[drug]

            amount_str = input(f"How many? (max: {have}): ").strip()

            if not amount_str.isdigit():
                print("Invalid amount!")
                return

            amount = int(amount_str)

            if amount <= 0 or amount > have:
                print(f"You only have {have}!")
                return

            total_earnings = amount * price
            self.cash += total_earnings
            self.inventory[drug] -= amount

            if self.inventory[drug] == 0:
                del self.inventory[drug]

            print(f"\nSold {amount} units of {drug} for ${total_earnings:,}")

        except (ValueError, KeyboardInterrupt):
            print("\nCancelled.")

    def jet_to_city(self):
        """Travel to another city."""
        print("\nWhere do you want to jet to?")
        print("-" * 40)
        for i, city in enumerate(self.cities, 1):
            if city != self.current_city:
                print(f"{i}. {city}")
        print("-" * 40)

        try:
            choice = input("Choose city (number or name, or 'cancel'): ").strip()

            if choice.lower() == 'cancel':
                return

            new_city = None

            # Handle numeric choice
            if choice.isdigit():
                idx = int(choice) - 1
                available_cities = [c for c in self.cities if c != self.current_city]
                if 0 <= idx < len(available_cities):
                    new_city = available_cities[idx]
            else:
                # Handle name choice
                for city in self.cities:
                    if city.lower() == choice.lower() and city != self.current_city:
                        new_city = city
                        break

            if not new_city:
                print("Invalid city!")
                return

            self.current_city = new_city
            self.day += 1
            self.generate_prices()
            self.random_event()

            # Accrue interest on debt
            if self.debt > 0 and self.day % 5 == 0:
                interest = int(self.debt * 0.1)
                self.debt += interest
                print(f"\n*** The loan shark charged you ${interest:,} interest! ***")

            print(f"\n>>> Jetted to {self.current_city} <<<")

        except (ValueError, KeyboardInterrupt):
            print("\nCancelled.")

    def visit_loan_shark(self):
        """Handle loan shark interactions."""
        print("\n--- The Loan Shark ---")
        print(f"Current Debt: ${self.debt:,}")
        print(f"Current Cash: ${self.cash:,}")

        print("\n1. Pay off debt")
        print("2. Borrow money")
        print("3. Leave")

        try:
            choice = input("\nChoice: ").strip()

            if choice == "1" and self.debt > 0:
                max_pay = min(self.cash, self.debt)
                amount_str = input(f"How much to pay? (max: ${max_pay:,}): ").strip()

                if amount_str.isdigit():
                    amount = int(amount_str)
                    if 0 < amount <= max_pay:
                        self.cash -= amount
                        self.debt -= amount
                        print(f"\nPaid ${amount:,}. Remaining debt: ${self.debt:,}")
                    else:
                        print("Invalid amount!")

            elif choice == "2":
                max_borrow = 10000
                amount_str = input(f"How much to borrow? (max: ${max_borrow:,}): ").strip()

                if amount_str.isdigit():
                    amount = int(amount_str)
                    if 0 < amount <= max_borrow:
                        self.cash += amount
                        self.debt += amount
                        print(f"\nBorrowed ${amount:,}. Total debt: ${self.debt:,}")
                    else:
                        print("Invalid amount!")

        except (ValueError, KeyboardInterrupt):
            print("\nCancelled.")

    def visit_bank(self):
        """Handle bank interactions."""
        print("\n--- The Bank ---")
        print(f"Bank Balance: ${self.bank:,}")
        print(f"Current Cash: ${self.cash:,}")

        print("\n1. Deposit")
        print("2. Withdraw")
        print("3. Leave")

        try:
            choice = input("\nChoice: ").strip()

            if choice == "1":
                amount_str = input(f"Deposit how much? (max: ${self.cash:,}): ").strip()

                if amount_str.isdigit():
                    amount = int(amount_str)
                    if 0 < amount <= self.cash:
                        self.cash -= amount
                        self.bank += amount
                        print(f"\nDeposited ${amount:,}. Bank balance: ${self.bank:,}")
                    else:
                        print("Invalid amount!")

            elif choice == "2":
                amount_str = input(f"Withdraw how much? (max: ${self.bank:,}): ").strip()

                if amount_str.isdigit():
                    amount = int(amount_str)
                    if 0 < amount <= self.bank:
                        self.bank -= amount
                        self.cash += amount
                        print(f"\nWithdrew ${amount:,}. Bank balance: ${self.bank:,}")
                    else:
                        print("Invalid amount!")

        except (ValueError, KeyboardInterrupt):
            print("\nCancelled.")

    def calculate_net_worth(self) -> int:
        """Calculate player's total net worth."""
        inventory_value = 0
        for drug, amount in self.inventory.items():
            # Use average price for valuation
            avg_price = (self.drugs[drug]["min"] + self.drugs[drug]["max"]) // 2
            inventory_value += amount * avg_price

        return self.cash + self.bank + inventory_value - self.debt

    def main_menu(self):
        """Display main menu and handle player actions."""
        while self.day <= self.max_days:
            self.display_status()

            print("\nWhat do you want to do?")
            print("1. Buy drugs")
            print("2. Sell drugs")
            print("3. Jet to another city")
            print("4. Visit loan shark")
            print("5. Visit bank")
            print("6. Check inventory")
            print("7. Quit game")

            try:
                choice = input("\nChoice: ").strip()

                if choice == "1":
                    self.buy_drug()
                elif choice == "2":
                    self.sell_drug()
                elif choice == "3":
                    self.jet_to_city()
                elif choice == "4":
                    self.visit_loan_shark()
                elif choice == "5":
                    self.visit_bank()
                elif choice == "6":
                    self.display_inventory()
                elif choice == "7":
                    if input("Are you sure you want to quit? (y/n): ").lower() == 'y':
                        break
                else:
                    print("Invalid choice!")

            except KeyboardInterrupt:
                print("\n\nGame interrupted!")
                break

        self.end_game()

    def end_game(self):
        """Display end game statistics."""
        print("\n" + "=" * 60)
        print(" GAME OVER ".center(60, "="))
        print("=" * 60)

        net_worth = self.calculate_net_worth()

        print(f"\nFinal Statistics:")
        print(f"  Days Survived: {min(self.day, self.max_days)}/{self.max_days}")
        print(f"  Cash: ${self.cash:,}")
        print(f"  Bank: ${self.bank:,}")
        print(f"  Debt: ${self.debt:,}")
        print(f"\n  NET WORTH: ${net_worth:,}")

        # Ranking
        if net_worth < 0:
            rank = "Broke Junkie"
        elif net_worth < 5000:
            rank = "Street Dealer"
        elif net_worth < 20000:
            rank = "Hustler"
        elif net_worth < 50000:
            rank = "Dealer"
        elif net_worth < 100000:
            rank = "Big Timer"
        elif net_worth < 250000:
            rank = "Kingpin"
        else:
            rank = "Drug Lord"

        print(f"\n  Rank: {rank}")
        print("\n" + "=" * 60)


def main():
    """Main game entry point."""
    print("=" * 60)
    print(" DRUG WARS ".center(60, "="))
    print("=" * 60)
    print("\nBased on the classic 1984 game by John E. Dell")
    print("\nYou have 30 days to make as much money as possible")
    print("by buying and selling drugs in New York City.")
    print("\nYou start with $2,000 cash and $5,500 in debt.")
    print("Travel between cities, watch for price fluctuations,")
    print("and beware of Officer Hardass!")
    print("\n" + "=" * 60)

    input("\nPress Enter to start...")

    game = DrugWars()
    game.main_menu()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nThanks for playing!")
        sys.exit(0)
