// @ts-nocheck
import { DiscountApplicationStrategy } from "../generated/api";
/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 * @typedef {import("../generated/api").Target} Target
 * @typedef {import("../generated/api").ProductVariant} ProductVariant
 */
const EMPTY_DISCOUNT = {
    discountApplicationStrategy: DiscountApplicationStrategy.All,
    discounts: [],
};
export function run(input) {
    const configuration = JSON.parse(
        input?.discountNode?.metafield?.value ?? "{}"
    );
    const discountProducts = configuration.products;
    const collections = configuration.collections;
    const tags = configuration.tags;
    const excludetags = configuration.excludetags;
    const ranges = configuration.ranges;
    const vendors = configuration.vendors;
    const types = configuration.types;
    const customerEligibility = configuration.customer_eligibility;
    const segments = configuration.segments;
    const customers = configuration.customers;
    const discounts = [];
    const presentmentCurrencyRate = input.presentmentCurrencyRate;

    input.cart.lines
        .filter((line) => line.merchandise.__typename == "ProductVariant")
        .forEach((line) => {
            const variant = /** @type {ProductVariant} */ (line.merchandise);
            const target = /** @type {Target} */ ({
                productVariant: {
                    id: variant.id,
                },
            });
            

            // Check if this discount is targeted to any specific product variant
            if (discountProducts.length > 0 && !discountProducts.some(product => product.variants.some(variant => variant.id === target.productVariant.id))){
                return EMPTY_DISCOUNT;
            } else if (vendors.length > 0 && !vendors.some(vendor => vendor === line.merchandise.product.vendor)) { // This line targeted to the speceific vendor
                return EMPTY_DISCOUNT;
            } else if (types.length > 0 && !types.some(type => type === line.merchandise.product.productType)) { // This line targeted to the speceific type
                return EMPTY_DISCOUNT;
            } else if (collections.length > 0 && line.merchandise.product.inAnyCollection == false) { // This line targeted to the speceific collection
                return EMPTY_DISCOUNT;
            } else if (tags.length > 0 && line.merchandise.product.hasAnyTag == false) { // This line targeted to the any tag of products
                return EMPTY_DISCOUNT;
            } 

            // If any excludes tag  exists in the cart product tags,  then the discount not applied to this product 
            if (excludetags.length > 0 && line.merchandise.product.hasAnyExcludeTag == true){
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

            // Find the applicable discount range based on quantity
            let maxRange = null;
            let maxQuantity = 0;
            ranges.forEach(range => {
                const targetQuantity = range.quantity;
                if (line.quantity >= targetQuantity && targetQuantity >= maxQuantity) {
                    maxQuantity = targetQuantity;
                    maxRange = range;
                }
            });
            const applicableRange = maxRange;


            /*
             *  If any cart product quantity match to our range quantity
             *  Discount will be applied to this product
             *  If currency is not set discount will be added based on parcentage 
             *  Otherwise it will be added based on amount
             *  All discount will be applied on per unit price
            */ 
    
            if (applicableRange) {
                if (applicableRange.percent_or_currency == '%'){ 
                    const percentageValue = applicableRange.amount;
                    discounts.push({
                        targets: [target],
                        value: {
                            percentage: {
                                value: percentageValue.toString(), // This value is applied for parcentage
                            },
                        },
                    });
                }else{
                    const percentageValue = parseFloat(applicableRange.amount) * presentmentCurrencyRate;
                    discounts.push({
                        targets: [target],
                        value: {
                            fixedAmount: {
                                amount: percentageValue.toString(), // This value is applied for currency
                                // This flag is TRUE so this amount is discounted from each item instead of the total amount
                                appliesToEachItem: true,
                            },
                        },
                    });
                }
            }
        });
    return {
        discounts,
        discountApplicationStrategy: DiscountApplicationStrategy.All,
    };
}