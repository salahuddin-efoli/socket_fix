import { json } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { createActivityLog } from '../libs/helpers';

export const action = async ({ request }) => {
    // Authenticate this request has came from Shopify Theme App Extension
    try {
        await authenticate.public.appProxy(request);
    } catch (error) {
        return json({
            response: "error",
            data: null,
        });
    }
    const { searchParams } = new URL(request.url);
    const myshopifyDomain = searchParams.get("shop");
    const logged_in_customer_id = searchParams.get("logged_in_customer_id");

    const formdata = await request.formData();
    const variant_id = formdata.get("variant_id");
    const product_quantity = formdata.get("product_quantity");
    const product_tags = JSON.parse(formdata.get("product_tags"));
    const product_vendor = formdata.get("product_vendor");
    const product_type = formdata.get("product_type");
    const product_collection_ids = JSON.parse(formdata.get("product_collection_ids"));

    try {
        // First get the shop info by "my shopify domain"
        const shop = await prisma.shops.findFirst({
            select: {
                id: true,
                setting: true,
            },
            where: {
                myshopifyDomain: myshopifyDomain
            }
        });

        const currentDate = new Date();
        // Now get all the discounts of this shop
        const discounts = await prisma.discounts.findMany({
            select: {
                title: true,
                type: true,
                startsAt: true,
                endsAt: true,
                discountValues: true,
            },
            where: {
                shopId: shop.id,
                deletedAt: null,
                status: "ACTIVE",
                AND: [
                    {
                        startsAt: { lte: currentDate }, // startsAt should be before today
                    },
                    {
                        OR: [
                            { endsAt: { gte: currentDate } }, // endsAt should be after today (if present)
                            { endsAt: null }, // OR endsAt can be null
                        ]
                    }
                ]
            }
        });

        let selectedDiscounts = [];
        if(discounts.length > 0) {
            for (let index = 0; index < discounts.length; index++) {
                let selectedDiscount = {};
                const discount = discounts[index];
                const discountValues = JSON.parse(discount.discountValues);

                // Check if this discount is targeted towards any specific customers
                if(discountValues.customer_eligibility == "customer" && (!logged_in_customer_id || !discountValues.customers.some(customer => customer.id === `gid://shopify/Customer/${logged_in_customer_id}`))) {
                    continue;
                }

                if(discount.type == "PRICE_DISCOUNT") {
                    // Check if current variant exists in ranges' variant array
                    const variantExists = discountValues.ranges.find(range => range.id == `gid://shopify/ProductVariant/${variant_id}`);
                    if(!variantExists) {
                        continue;
                    }

                    selectedDiscount.title = discount.title;
                    selectedDiscount.type = discount.type;
                    selectedDiscount.ranges = variantExists.prices;
                    selectedDiscounts.push(selectedDiscount);
                }
                else if(discount.type == "QUANTITY_DISCOUNT") {
                    // Check apply to type
                    // Conditions on when discount applied to products
                    if(discountValues.applyType == "product") {
                        // Check if there is any product in products array
                        if(discountValues.products.length == 0) {
                            continue;
                        }
                        // Check if current product/variant exists in products' variant array
                        const variantExists = discountValues.products.some(product =>
                            product.variants.some(variant => variant.id == `gid://shopify/ProductVariant/${variant_id}`)
                        );
                        if(!variantExists) {
                            continue;
                        }
                    }
                    // Conditions on when discount applied to collections
                    else if(discountValues.applyType == "collection") {
                        // Check if there is any collection in collections array
                        if(discountValues.collections.length == 0) {
                            continue;
                        }
                        // Check if product collection exists in products collection array
                        const collectionExists = discountValues.collections.some(collection => product_collection_ids.includes(String(collection.id)));
                        if(!collectionExists) {
                            continue;
                        }
                    }
                    // Conditions on when discount applied to tags
                    else if(discountValues.applyType == "tag") {
                        // Check if there is any tag in tags array
                        if(discountValues.tags.length == 0) {
                            continue;
                        }
                        // We are conveting the product tag to lowercase to avoid collisions
                        const lowercasedProductTags = product_tags.map(tag => tag.toLowerCase());
                        // Check if product tag exists in products tags array
                        const tagExists = discountValues.tags.some(tag => lowercasedProductTags.includes(tag.toLowerCase()));
                        if(!tagExists) {
                            continue;
                        }
                    }
                    // Conditions on when discount applied to vendors
                    else if(discountValues.applyType == "vendor") {
                        // Check if there is any vendor in vendors array
                        if(discountValues.vendors.length == 0) {
                            continue;
                        }
                        // Check if product vendor exists in products vendors array
                        const vendorExists = discountValues.vendors.includes(product_vendor);
                        if(!vendorExists) {
                            continue;
                        }
                    }
                    // Conditions on when discount applied to types
                    else if(discountValues.applyType == "type") {
                        // Check if there is any type in types array
                        if(discountValues.types.length == 0) {
                            continue;
                        }
                        // Check if product type exists in products types array
                        const typeExists = discountValues.types.includes(product_type);
                        if(!typeExists) {
                            continue;
                        }
                    }
                    // Check if product tag exists in products excluded tags array
                    if(discountValues.checkExcludeTag && discountValues.excludetags.length > 0) {
                        // We are conveting the product tag to lowercase to avoid collisions
                        const lowercasedProductTags = product_tags.map(tag => tag.toLowerCase());
                        const excludetagsExists = discountValues.excludetags.some(tag => lowercasedProductTags.includes(tag.toLowerCase()));
                        if(excludetagsExists) {
                            continue;
                        }
                    }

                    selectedDiscount.title = discount.title;
                    selectedDiscount.type = discount.type;
                    selectedDiscount.ranges = discountValues.ranges;
                    selectedDiscounts.push(selectedDiscount);
                }
            }
        }

        const mergedRanges = selectedDiscounts.flatMap(discount =>
            discount.ranges.map(range => ({
                type: discount.type,
                ...range,
            }))
        );
        mergedRanges.sort((a, b) => a.quantity - b.quantity);

        return json({
            response: "success",
            data: mergedRanges || [],
            settings: JSON.parse(shop.setting.productPage)|| {}
        });
    } catch (error) {
        createActivityLog({type: "error", shop: myshopifyDomain, subject: "Getting discount ranges from Storefront", body: error});
        return json({
            response: "error",
            data: error,
        });
    }
};