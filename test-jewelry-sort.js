
const jewelryItems = [
    {
        jewelryName: "Camille",
        pricing: {
            metalPricing: [
                {
                    metal: { name: "14K" },
                    grandTotal: { natural: 658 }
                },
                {
                    metal: { name: "18K" },
                    grandTotal: { natural: 809.23 }
                }
            ]
        }
    },
    {
        jewelryName: "Aura",
        pricing: {
            metalPricing: [
                {
                    metal: { name: "14K" },
                    grandTotal: { natural: 450 }
                }
            ]
        }
    },
    {
        jewelryName: "Seraphina",
        pricing: {
            metalPricing: [
                {
                    metal: { name: "14K" },
                    grandTotal: { natural: 1200 }
                }
            ]
        }
    },
    {
        jewelryName: "Luna",
        pricing: {
            metalPricing: [
                {
                    metal: { name: "14K" },
                    grandTotal: { natural: 300 }
                }
            ]
        }
    }
];

function simulateSort(items, priceSort) {
    const priceField = 'pricing.metalPricing.grandTotal.natural';

    // Helper to get nested value
    const getNestedValue = (obj, path) => {
        return path.split('.').reduce((current, key) => current && current[key], obj);
    };

    // Note: For jewelry, the grandTotal is usually taken from the first metal entry 
    // or a specific one. In this demo, we'll use the price of the first metal entry.
    const getPrice = (item) => {
        if (item.pricing && item.pricing.metalPricing && item.pricing.metalPricing[0]) {
            return item.pricing.metalPricing[0].grandTotal.natural;
        }
        return 0;
    };

    const sorted = [...items].sort((a, b) => {
        const priceA = getPrice(a);
        const priceB = getPrice(b);

        if (priceSort === 'lowToHigh') {
            return priceA - priceB;
        } else if (priceSort === 'highToLow') {
            return priceB - priceA;
        }
        return 0;
    });

    return sorted.map(item => ({
        "Design Name": item.jewelryName,
        "Price (Natural)": getPrice(item)
    }));
}

console.log("--- Simulation: priceSort = lowToHigh ---");
console.table(simulateSort(jewelryItems, 'lowToHigh'));

console.log("\n--- Simulation: priceSort = highToLow ---");
console.table(simulateSort(jewelryItems, 'highToLow'));
