const mongoose = require('mongoose');
const Schema = require('../models/schema');

// Define models if they don't exist
const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');
const Coupon = mongoose.models.couponModel || mongoose.model('couponModel', new mongoose.Schema(Schema.coupon), 'coupons');
const FlatDiscount = mongoose.models.flatDiscountModel || mongoose.model('flatDiscountModel', new mongoose.Schema(Schema.flatdiscount), 'flatdiscounts');

/**
 * Two-rule jewelry pricing engine (single source of truth):
 *   Engagement rings  → pricing.metalPricing[n].finalPrice.{natural|lab}
 *   All other jewelry → addedDiamonds.selectedDiamonds[n].metalPricing[n].priceNatural|priceLab
 */
function getJewelryPrice(product, item) {
    const selectedMetalId = item?.selectedVariant?.selectedOptions?.metaldetail;
    const diamondType = item?.diamondDetails?.diamondType
        || item?.selectedVariant?.selectedOptions?.diamondType
        || 'Natural';
    const isNatural = diamondType.toLowerCase() !== 'lab';
    const priceKey = isNatural ? 'natural' : 'lab';

    const cat = product.category;
    const catValue = (cat && typeof cat === 'object' && cat.value)
        ? cat.value
        : (typeof cat === 'string' ? cat : '');
    const isEngagement = catValue.toLowerCase().includes('engagement');

    if (isEngagement && Array.isArray(product.pricing?.metalPricing) && product.pricing.metalPricing.length > 0) {
        if (selectedMetalId) {
            const entry = product.pricing.metalPricing.find(p => {
                const id = p.metal?.id || p.metal;
                return id && id.toString() === selectedMetalId.toString();
            });
            if (entry?.finalPrice?.[priceKey] > 0) return entry.finalPrice[priceKey];
        }
        // No specific metal selected — return first available entry
        const first = product.pricing.metalPricing[0];
        if (first?.finalPrice?.[priceKey] > 0) return first.finalPrice[priceKey];
    }

    // Non-engagement: addedDiamonds path
    const diamonds = product.addedDiamonds?.selectedDiamonds;
    if (Array.isArray(diamonds) && diamonds.length > 0) {
        // Filter to natural or lab diamond entry based on diamondType
        const targetDiamond = diamonds.find(d => {
            const name = (d.color || '').toLowerCase();
            return isNatural ? !name.includes('lab') : name.includes('lab');
        }) || diamonds[0];

        if (Array.isArray(targetDiamond?.metalPricing) && targetDiamond.metalPricing.length > 0) {
            if (selectedMetalId) {
                // Try direct ObjectId match
                let metalEntry = targetDiamond.metalPricing.find(m =>
                    m.metal && m.metal.toString() === selectedMetalId.toString()
                );

                // ObjectId didn't match — resolve metal name from pricing.metalPricing then match by name
                if (!metalEntry && Array.isArray(product.pricing?.metalPricing)) {
                    const pricingEntry = product.pricing.metalPricing.find(p => {
                        const id = p.metal?.id || p.metal;
                        return id && id.toString() === selectedMetalId.toString();
                    });
                    const metalName = pricingEntry?.metal?.name; // e.g. "14K" or "18K"
                    if (metalName) {
                        metalEntry = targetDiamond.metalPricing.find(m =>
                            m.metal && m.metal.toString().toUpperCase().includes(metalName.toUpperCase())
                        );
                    }
                }

                if (metalEntry) {
                    const p = isNatural ? metalEntry.priceNatural : metalEntry.priceLab;
                    if (p > 0) return p;
                }
            }
            // Fallback: first metal entry
            const firstMetal = targetDiamond.metalPricing[0];
            const p = isNatural ? firstMetal.priceNatural : firstMetal.priceLab;
            if (p > 0) return p;
        }
    }

    return item?.priceAtTime || product.price || 0;
}

/**
 * Helper function to calculate product price based on selected variations
 */
function calculateProductPrice(product, selectedOptions) {
    // Always use the two-rule engine (getJewelryPrice) as the primary source.
    // engagement rings  → pricing.metalPricing[n].finalPrice.{natural|lab}
    // all other jewelry → addedDiamonds.selectedDiamonds[n].metalPricing[n].priceNatural|priceLab
    const enginePrice = getJewelryPrice(product, { selectedVariant: { selectedOptions } });
    if (enginePrice && enginePrice > 0) return enginePrice;

    return product.price || 0;
}

/**
 * Centrally calculates cart totals, automatic flat discounts, and manual coupons.
 * This is the SINGLE SOURCE OF TRUTH for all pricing in the system.
 */
async function calculateCartSummary(cart) {
    let subtotal = 0;
    let totalItems = 0;
    const appliedDiscounts = [];
    const itemsWithDetails = [];

    // 1. Calculate base subtotal and prepare item details
    for (const item of cart.items) {
        const product = await Jewelry.findById(item.productId);
        if (!product) continue;

        // Use priceAtTime (locked price) or current product price with variants
        let unitPrice = item.priceAtTime;
        if (!unitPrice || unitPrice <= 0) {
            unitPrice = calculateProductPrice(product, item.selectedVariant?.selectedOptions);
        }

        // Total for this item
        const itemSubtotal = unitPrice * item.quantity;
        subtotal += itemSubtotal;
        totalItems += item.quantity;

        itemsWithDetails.push({
            ...item.toObject ? item.toObject() : item,
            product,
            unitPrice,
            itemSubtotal
        });
    }

    // 2. Fetch and apply Automatic Flat Discounts
    const now = new Date();
    const activeFlatDiscounts = await FlatDiscount.find({
        status: true,
        $or: [{ validTill: { $exists: false } }, { validTill: null }, { validTill: { $gte: now } }]
    });
    let flatDiscountAmount = 0;

    // Normalize a category string to slug form for comparison.
    // "Engagement Rings" → "engagement-rings"
    // "engagement-rings" → "engagement-rings"
    function normalizeCategory(cat) {
        return (cat || '').toLowerCase().trim().replace(/\s+/g, '-');
    }

    for (const itemData of itemsWithDetails) {
        const product = itemData.product;
        const itemSubtotal = itemData.itemSubtotal;

        let bestDiscountForThisItem = 0;
        let bestFD = null;

        for (const fd of activeFlatDiscounts) {
            // Check minimum order value against the FULL cart subtotal
            if (subtotal < (fd.minimumOrderValue || 0)) continue;

            let isEligible = false;

            // --- Eligibility by targeting mode ---
            if (fd.allowThisDiscount === 'all') {
                isEligible = true;

            } else if (fd.allowThisDiscount === 'selectProducts') {
                if (fd.selectedProductIds?.some(id => id.toString() === product._id.toString())) {
                    isEligible = true;
                }

            } else if (fd.allowThisDiscount === 'cadCode') {
                // CAD code targeting: match product.cadCode against selectedCadCodes array
                if (product.cadCode && fd.selectedCadCodes?.length > 0) {
                    if (fd.selectedCadCodes.some(code => code.trim().toLowerCase() === product.cadCode.trim().toLowerCase())) {
                        isEligible = true;
                    }
                }
            }

            // --- Optional category filter ---
            // Applies on top of the targeting mode above.
            // Normalizes both sides to slug format so "Engagement Rings" == "engagement-rings".
            if (fd.discountCategory) {
                const fdCatSlug = normalizeCategory(fd.discountCategory);
                const prodRaw = (product.category && typeof product.category === 'object')
                    ? product.category.value
                    : product.category;
                const prodCatSlug = normalizeCategory(prodRaw);

                if (prodCatSlug && prodCatSlug === fdCatSlug) {
                    // Category matches — keep isEligible as-is
                } else if (fd.allowThisDiscount === 'selectProducts' && isEligible) {
                    // Product was explicitly selected — category filter is bypassed
                } else if (fd.allowThisDiscount === 'cadCode' && isEligible) {
                    // CAD-code targeted — category filter is bypassed
                } else {
                    isEligible = false;
                }
            }

            if (!isEligible) continue;

            // --- Pick correct discount value (Natural vs Lab) ---
            // Use the user's selected diamond type from the cart item, NOT the product's diamondType field.
            const selectedDiamondType = itemData.diamondDetails?.diamondType
                || itemData.selectedVariant?.selectedOptions?.diamondType
                || product.diamondType
                || 'Natural';
            const discountValue = selectedDiamondType === 'Lab' ? fd.labDiscount : fd.naturalDiscount;

            if (!discountValue || discountValue <= 0) continue;

            // --- Calculate discount amount ---
            // For Custom-type items, discount applies only to the setting price (not diamond markup).
            const diamondMarkup = itemData.product?.type === 'Custom'
                ? (Number(itemData.diamondDetails?.markup_price) || 0)
                : 0;
            const discountableSubtotal = Math.max(0, itemSubtotal - diamondMarkup);

            let currentDiscount = 0;
            const unit = (fd.discountUnit || '').trim();
            if (unit === '%') {
                currentDiscount = (discountableSubtotal * discountValue) / 100;
            } else {
                // Flat $ amount per item — cap at discountable portion
                currentDiscount = Math.min(discountValue * (itemData.quantity || 1), discountableSubtotal);
            }

            if (currentDiscount > bestDiscountForThisItem) {
                bestDiscountForThisItem = currentDiscount;
                bestFD = { name: fd.discountName, amount: currentDiscount };
            }
        }

        if (bestDiscountForThisItem > 0) {
            flatDiscountAmount += bestDiscountForThisItem;
            appliedDiscounts.push({
                productId: itemData.productId,
                discountName: bestFD.name,
                amount: bestDiscountForThisItem,
                type: 'Automatic'
            });
        }
    }

    // 3. Apply Manual Coupon
    let couponDiscountAmount = 0;
    if (cart.coupon && cart.coupon.code) {
        const coupon = await Coupon.findOne({ couponCode: cart.coupon.code, isActive: true, isDeleted: { $ne: true } });
        if (coupon) {
            // Check minimum order amount
            const meetsMinimum = subtotal >= (coupon.minimumAmount || 0);

            // Check coupon date validity
            const now = new Date();
            const withinDateRange = (!coupon.dateRange?.start || new Date(coupon.dateRange.start) <= now)
                && (!coupon.dateRange?.end || new Date(coupon.dateRange.end) >= now);

            if (meetsMinimum && withinDateRange) {
                // Calculate the eligible base for this coupon (respects category/product targeting)
                let eligibleBase = 0;

                for (const itemData of itemsWithDetails) {
                    const product = itemData.product;

                    // For Custom-type items, apply discount only to the setting price (not the diamond markup).
                    // The diamond price is a pass-through cost and should not be discounted.
                    const diamondMarkup = product.type === 'Custom'
                        ? (Number(itemData.diamondDetails?.markup_price) || 0)
                        : 0;
                    const settingSubtotal = (itemData.unitPrice - diamondMarkup / (itemData.quantity || 1)) * (itemData.quantity || 1);
                    const discountableAmount = Math.max(0, settingSubtotal);

                    let itemEligible = false;

                    if (!coupon.categoryWise && !coupon.productWise) {
                        // Global coupon — applies to all items
                        itemEligible = true;

                    } else if (coupon.productWise && coupon.selectedProducts?.length > 0) {
                        // Product-specific coupon
                        if (coupon.selectedProducts.some(id => id.toString() === product._id.toString())) {
                            itemEligible = true;
                        }

                    } else if (coupon.categoryWise && coupon.selectedCategory?.length > 0) {
                        // Category-specific coupon — match product category against the allowed list
                        const prodCatRaw = (product.category && typeof product.category === 'object')
                            ? product.category.value
                            : product.category;
                        const prodCatSlug = normalizeCategory(prodCatRaw);

                        const matched = coupon.selectedCategory.some(c => {
                            // Also match diamondType categories ("Natural" / "Lab Grown")
                            const catSlug = normalizeCategory(c);
                            if (catSlug === prodCatSlug) return true;
                            // Match Natural/Lab diamond type selection on the item
                            const itemDiamondType = (itemData.diamondDetails?.diamondType || '').toLowerCase();
                            if (catSlug === 'natural' && itemDiamondType === 'natural') return true;
                            if ((catSlug === 'lab-grown' || catSlug === 'lab') && itemDiamondType.includes('lab')) return true;
                            return false;
                        });
                        if (matched) itemEligible = true;
                    }

                    if (itemEligible) {
                        eligibleBase += discountableAmount;
                    }
                }

                if (eligibleBase > 0) {
                    if (coupon.discountType === 'Percentage') {
                        couponDiscountAmount = (eligibleBase * coupon.discountValue) / 100;
                    } else if (coupon.discountType === 'Flat') {
                        couponDiscountAmount = Math.min(coupon.discountValue, eligibleBase);
                    }
                }
            }
        }
    }

    const total = Math.max(0, subtotal - flatDiscountAmount - couponDiscountAmount);

    // Round all prices to 2 decimal places to avoid floating-point artifacts
    const roundPrice = (price) => Math.round(price * 100) / 100;

    return {
        subtotal: roundPrice(subtotal),
        flatDiscountAmount: roundPrice(flatDiscountAmount),
        couponDiscountAmount: roundPrice(couponDiscountAmount),
        totalDiscount: roundPrice(flatDiscountAmount + couponDiscountAmount),
        discountAmount: roundPrice(flatDiscountAmount + couponDiscountAmount), // Compatibility
        total: roundPrice(total),
        itemCount: cart.items.length,
        totalItems,
        hasItems: totalItems > 0,
        appliedDiscounts,
        itemsWithDetails // Useful for checkout processes needing product info
    };
}

module.exports = {
    calculateCartSummary,
    calculateProductPrice,
    getJewelryPrice
};
