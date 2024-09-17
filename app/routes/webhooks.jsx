import { calculateRemainingTrialDays, createActivityLog } from "../libs/helpers";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
    const { topic, shop, session, admin, payload } = await authenticate.webhook(request);
    createActivityLog({type: "info", shop: shop, subject: "Webhook payload data", body: {topic, shop, payload}});

    // Find out shop information using shop domain 
    const shopInfo = await prisma.shops.findFirst({ where:{ myshopifyDomain: shop }, orderBy:{ id: 'desc'} });

    if (!admin) {
        // The admin context isn't returned if the webhook fired after a shop was uninstalled.
        throw new Response();
    }

    const discount_id = payload?.admin_graphql_api_id;

    switch (topic) {
        case "APP_UNINSTALLED":
        if (session && shopInfo) {
            await prisma.shops.update({
                where:{
                    id: shopInfo.id,
                },
                data : {
                    planId: null,
                    planMonthlyPrice: null,
                    planMonthlyDiscount: null,
                    planAnnualPrice: null,
                    planAnnualDiscount: null,
                    planType: null,
                    planBillingPrice: null,
                    trialStartsAt: null,
                    trialPeriod: calculateRemainingTrialDays(shopInfo.trialStartsAt, shopInfo.trialPeriod)
                }
            });
            await prisma.session.deleteMany({ where: { shop } });
        }
        break;

        case "DISCOUNTS_DELETE":
        if(discount_id) {
            await prisma.discounts.update({
                where: {
                    discountId: discount_id
                },
                data: {
                    deletedAt: new Date().toISOString()
                },
            });
        }
        break;

        case "DISCOUNTS_UPDATE":
        if(discount_id) {
            const query = `#graphql
            query singleDiscount {
                discountNode(id: "${discount_id}" ) {
                    discount {
                        ... on DiscountAutomaticApp {
                            endsAt
                            startsAt
                            title
                            updatedAt
                            status
                            discountId
                            createdAt
                        }
                    }
                }
            }
            `;
            const response = await admin.graphql(query)
            const responseJson = await response.json();

            if(responseJson?.data?.discountNode?.discount) {
                await prisma.discounts.update({
                    where: {
                        discountId: discount_id
                    },
                    data: {
                        status: payload.status,
                        startsAt: responseJson.data.discountNode.discount.startsAt,
                        endsAt: responseJson.data.discountNode.discount.endsAt,
                        updatedAt: responseJson.data.discountNode.discount.updatedAt,
                    },
                })
            }
        }
        break;

        case "CUSTOMERS_DATA_REQUEST":
        case "CUSTOMERS_REDACT":
        case "SHOP_REDACT":
        default:
        throw new Response("Unhandled webhook topic", { status: 404 });
    }

    throw new Response();
}
