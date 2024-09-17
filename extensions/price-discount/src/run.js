// @ts-nocheck
import { DiscountApplicationStrategy } from "../generated/api";

// Use JSDoc annotations for type safety
/**
* @typedef {import("../generated/api").RunInput} RunInput
* @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
* @typedef {import("../generated/api").Target} Target
* @typedef {import("../generated/api").ProductVariant} ProductVariant
*/

/**
* @type {FunctionRunResult}
*/
const EMPTY_DISCOUNT = {
    discountApplicationStrategy: DiscountApplicationStrategy.All,
    discounts: [],
};

// The configured entrypoint for the 'purchase.product-discount.run' extension target
/**
* @param {RunInput} input
* @returns {FunctionRunResult}
*/
export function run(input) {
    // Get all the discount data from discount metafield for configuration
    const configuration = JSON.parse(input?.discountNode?.metafield?.value || "{}");
    const product = configuration.product;
    const customerEligibility = configuration.customer_eligibility;
    const segments = configuration.segments;
    const customers = configuration.customers;
    const ranges = configuration.ranges;
    const discounts = [];
    const presentmentCurrencyRate = input.presentmentCurrencyRate;

    // Loop through the cart items to apply discount on each of them
    input.cart.lines.filter((line) => line.merchandise.__typename == "ProductVariant").forEach((line) => {
        const variant = /** @type {ProductVariant} */ (line.merchandise);
        const target = /** @type {Target} */ ({
            productVariant: {
                id: variant.id,
            },
        });

        // Check if this product is allowed to have a discount
        if (!product.variants.some(variant => variant.id === target.productVariant.id)) {
            return EMPTY_DISCOUNT;
        }

        // Check if this discount is targeted to any specific customer(s)
        if(customerEligibility == "customer") {
            // Check if, currently is there any logged in customer
            if(input.cart.buyerIdentity?.email) {
                // Check if currently logged in customer is in targeted customer list by searching via email
                const customerFound = customers.some(customer => customer.email == input.cart.buyerIdentity.email) || false;
                // If current customer is not included in the targeted customer list then there is no discount
                if(!customerFound) {
                    return EMPTY_DISCOUNT;
                }
            }
            // If not then there is no discount
            else {
                return EMPTY_DISCOUNT;
            }
        }

        // First find the proper quantity from the range array based on variant
        // Then get the applicable discount range based on quantity
        let maxRange = null;
        let maxQuantity = 0;
        const variantRanges = ranges.find(range => range.id == target.productVariant.id);
        variantRanges.prices.forEach(range => {
            const targetQuantity = range.quantity;
            if (line.quantity >= targetQuantity && targetQuantity >= maxQuantity) {
                maxQuantity = targetQuantity;
                maxRange = range;
            }
        });

        if (maxRange) {
            // Calculate the actual unit price by multiplying the maxRange price with currency conversion rate
            // Get the discounted unit price for each cart item by subtracting merchant provided unit price from cart item unit price
            // For example a cart item has an unit price of $600
            // And the merchant provided unit price is $550
            // Now, we substract $550 from $600 to get $50 discount per item,
            // and provide $50 to each item as discount
            const applicablePrice = parseFloat(maxRange.price) * presentmentCurrencyRate;
            const dicountedPrice = (parseFloat(line.cost.amountPerQuantity.amount) - parseFloat(applicablePrice)) || 0;
            discounts.push({
                targets: [target],
                value: {
                    fixedAmount: {
                        // This is the discounted amount
                        amount: dicountedPrice,
                        // This flag is TRUE so this amount is discounted from each item instead of the total amount
                        appliesToEachItem: true,
                    },
                },
            });
        }
    });

    return {
        discounts,
        discountApplicationStrategy: DiscountApplicationStrategy.All,
    };
};
