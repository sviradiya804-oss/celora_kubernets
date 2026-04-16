
const mongoose = require('mongoose');

// Mock data
const mockProduct = {
    _id: 'product123',
    title: 'Diamond Ring',
    price: 500, // Base price
    pricing: {
        metalPricing: [
            {
                metal: 'metal123',
                finalPrice: { natural: 658, lab: 658 } // The price it was resetting to
            }
        ]
    }
};

const mockCartItem_WithCustomPrice = {
    productId: 'product123',
    quantity: 1,
    priceAtTime: 1821, // The custom calculated price (e.g. with specific diamond)
    selectedVariant: {
        selectedOptions: {
            metaldetail: 'metal123'
        }
    },
    toObject: () => mockCartItem_WithCustomPrice
};

const mockCartItem_WithoutCustomPrice = {
    productId: 'product123',
    quantity: 1,
    priceAtTime: 0,
    selectedVariant: {
        selectedOptions: {
            metaldetail: 'metal123'
        }
    },
    toObject: () => mockCartItem_WithoutCustomPrice
};

// Mock Helper function: compute cart total (simulating logic from checkout-direct.js)
async function computeCartTotal(cartItems) {
    let subtotal = 0;
    const itemsWithPrices = [];

    for (const item of cartItems) {
        const product = mockProduct; // Mock DB fetch

        // Calculate price based on variant or base price
        let finalPrice = item.priceAtTime || product.price || 0;

        // Try variant-specific pricing
        const selectedMetalId = item.selectedVariant?.selectedOptions?.metaldetail;
        if (selectedMetalId && product.pricing?.metalPricing) {
            const pricingEntry = product.pricing.metalPricing.find(p => {
                const metalId = p.metal; // Simplified for mock
                return metalId === selectedMetalId;
            });

            if (pricingEntry?.finalPrice) {
                // THE FIX: Check if priceAtTime exists before implementing override
                if (!item.priceAtTime || item.priceAtTime <= 0) {
                    console.log("   -> Overriding with base metal price");
                    finalPrice = pricingEntry.finalPrice.natural || pricingEntry.finalPrice.lab || finalPrice;
                } else {
                    console.log("   -> Keeping custom priceAtTime");
                }
            }
        }

        const itemTotal = finalPrice * item.quantity;
        subtotal += itemTotal;

        itemsWithPrices.push({
            ...item,
            calculatedPrice: finalPrice
        });
    }

    return { subtotal, itemsWithPrices };
}

async function runTest() {
    console.log("Test 1: Item with custom price (Diamond selection)");
    console.log("Expected: 1821");
    const result1 = await computeCartTotal([mockCartItem_WithCustomPrice]);
    console.log("Actual:   " + result1.subtotal);
    console.log("Status:   " + (result1.subtotal === 1821 ? "PASS ✅" : "FAIL ❌"));

    console.log("\nTest 2: Item without custom price (should fallback to metal base)");
    console.log("Expected: 658");
    const result2 = await computeCartTotal([mockCartItem_WithoutCustomPrice]);
    console.log("Actual:   " + result2.subtotal);
    console.log("Status:   " + (result2.subtotal === 658 ? "PASS ✅" : "FAIL ❌"));
}

runTest();
