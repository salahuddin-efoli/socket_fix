import { useLoaderData, useSearchParams } from "@remix-run/react";
import { Bleed, Box, Card, EmptyState, Page, SkeletonBodyText } from "@shopify/polaris";
import { useState } from "react";
import prisma from "../db.server";
import { calculateRemainingTrialDays, createActivityLog } from "../libs/helpers";
import { authenticate } from "../shopify.server";
import { useTranslation } from "react-i18next";

export const loader = async ({ param, request }) => {
    const { admin } = await authenticate.admin(request);
    const graphqlQuery = `#graphql
        query shop{
            app{
                installation{
                    activeSubscriptions{
                        id
                        name
                        createdAt
                        returnUrl
                        status
                        currentPeriodEnd
                        trialDays
                    }
                }
            }
            shop {
                id
                myshopifyDomain
            }
        }
    `;
    const response = await admin.graphql(graphqlQuery);
    const shopResponseJson = await response.json();
    const myshopifyDomain = shopResponseJson.data.shop.myshopifyDomain;
    createActivityLog({type: "info", shop: myshopifyDomain, subject: "App active subscription", body: shopResponseJson});

    if(shopResponseJson?.data?.app?.installation?.activeSubscriptions?.length > 0) {
        const planSubscription = shopResponseJson.data.app.installation.activeSubscriptions[0];

        // Get shop info from prima storage using shop GID
        const shop = await prisma.shops.findFirst({ where: { gid: shopResponseJson.data.shop.id } });

        const payment = await prisma.payments.findFirst({
            where: { shopId: shop.id },
            orderBy: { id: 'desc' },
            include: { plan: true }
        });

        if(payment) {
            if(payment.status == "ACCEPTED") {
                return {
                    target: "success",
                    message: "you_are_already_subscribed",
                    data: {
                        plan: payment.plan.title
                    },
                };
            }
            const appSubscription = payment.response ? JSON.parse(payment.response) : null;
            const responseSubscriptionId = appSubscription?.data?.appSubscriptionCreate?.appSubscription?.id;

            if ((responseSubscriptionId == planSubscription.id) && (planSubscription.status == "ACTIVE")) {
                // Find out trial days
                const remainingTrialPeriod = calculateRemainingTrialDays(shop.trialStartsAt, shop.trialPeriod);

                // Get charge ID from address URL
                const { searchParams } = new URL(request.url);
                const chargeId = searchParams.get("charge_id") || "";

                await prisma.$transaction([
                    prisma.shops.update({
                        where: { id: shop.id },
                        data: {
                            planId: parseInt(payment.planId),
                            planType: payment.planType,
                            planBillingPrice: payment.planPrice,
                            trialStartsAt: new Date().toISOString(),
                            trialPeriod: (remainingTrialPeriod != null && remainingTrialPeriod >= 0) ? remainingTrialPeriod : parseInt(import.meta.env.VITE_TRIAL_PERIOD),
                        }
                    }),
                    prisma.payments.update({
                        where: { id: payment.id },
                        data: {
                            chargeId: chargeId,
                            status: "ACCEPTED",
                        }
                    })
                ]);

                return {
                    target: "success",
                    message: "plan_update_success_message",
                    data: {
                        plan: payment.plan.title
                    },
                };
            } else {
                createActivityLog({ type: "error", shop: myshopifyDomain, subject: "AppSupcription id not found or payment decline!" });
                return {
                    target: "error",
                    message: "something_went_wrong",
                    data: [],
                };
            }
        } else {
            createActivityLog({ type: "error", shop: myshopifyDomain, subject: "Payment info not found!" });
            return {
                target: "error",
                message: "something_went_wrong",
                data: [],
            };
        }
    }
    createActivityLog({type: "error", shop: shopResponseJson.data.shop.myshopifyDomain, subject: "App active subscription", body: shopResponseJson, query: graphqlQuery});
    return {
        target: "error",
        message: "something_went_wrong",
        data: [],
    };
}

export default function PurchaseSuccess() {
    const { t } = useTranslation();
    const loaderData = useLoaderData() || {};

    const [searchParams] = useSearchParams();
    const charge_id = searchParams.get('charge_id');
    const [pageLoader, setPageLoader] = useState(true);

    if(loaderData) {
        if(pageLoader) {
            setPageLoader(false);
        }
    }

    return (
        <Bleed>
            <Page fullWidth>
                <Card>
                    {pageLoader ? (
                        <SkeletonBodyText />
                    ) : (
                        <Box>
                            {loaderData && loaderData.target == "success" ? (
                                <EmptyState
                                    heading={ t(loaderData.message, { plan: loaderData.data.plan }) }
                                    action={{ content: t("continue"), url: "/app/new-offer" }}
                                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                                >
                                    <p>{ t("enjoy_app_message") }</p>
                                </EmptyState>
                            ) : (
                                <EmptyState
                                    heading={ t("sorry_plan_update_failure") }
                                    action={{ content: 'Reload', url: "/app/purchase-success?charge_id=" + charge_id }}
                                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                                >
                                    <p>{ t("sorry_for_inconvenience") }</p>
                                </EmptyState>
                            )}
                        </Box>
                    )}
                </Card>
            </Page>
        </Bleed>
    );
}