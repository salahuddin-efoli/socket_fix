import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import { json } from "@remix-run/node";
import { Bleed, Card, EmptyState, Page, Text } from '@shopify/polaris';
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { createActivityLog } from "../libs/helpers";
import { useTranslation } from "react-i18next";

export const loader = async ({ request }) => {
    const { admin } = await authenticate.admin(request);

    const graphqlQuery = `#graphql
    query shop{
        shop {
            id
        }
    }`;
    const response = await admin.graphql(graphqlQuery, "");
    const shopResponseJson = await response.json();

    // Get shop info from prima storage using shop GID  
    const shop = await prisma.shops.findFirst({
        select: {
            id: true,
            myshopifyDomain: true,
        },
        where: { gid: shopResponseJson.data.shop.id },
    });

    return json({
        shop: shop,
    });
};

export const action = async({ request }) => {
    const formData = await request.formData();
    const shopId = formData.get("shopId");
    const myshopifyDomain = formData.get("myshopifyDomain");
    
    try {
        const plan = await prisma.plans.findFirst({
            where: { id: 1 }
        });

        if(plan && plan.id) {
            const shopInfo = await prisma.shops.findFirst({
                where: { id: parseInt(shopId) },
                select: {
                    id: true,
                    trialPeriod: true,
                }
            })
            const shopUpdatedInfo =  await prisma.shops.update({
                where: { id: shopInfo.id },
                data: {
                    planId: plan.id,
                    planMonthlyPrice: plan.monthlyPrice,
                    planMonthlyDiscount: 0,
                    planAnnualPrice: plan.annualPrice,
                    planAnnualDiscount: 0,
                    planType: "EVERY_30_DAYS",
                    trialStartsAt: new Date().toISOString(),
                    planBillingPrice: plan.monthlyPrice,
                    trialPeriod: (shopInfo.trialPeriod && shopInfo.trialPeriod > 0) ? shopInfo.trialPeriod : parseInt(import.meta.env.VITE_TRIAL_PERIOD),
                }
            });

            if(shopUpdatedInfo) {
                createActivityLog({type: "success", shop: myshopifyDomain, subject: "Continue with free - Shop info updated", body: shopUpdatedInfo});
                // Set free plan history to the prisma payment table 
                const newPayment = await prisma.payments.create({
                    data: {
                        shopId: parseInt(shopId),
                        planId: plan.id,
                        planType: "EVERY_30_DAYS",
                        planPrice: plan.monthlyPrice,
                        planBillingPrice: plan.monthlyPrice,
                        status: "ACCEPTED"
                    }
                });
                createActivityLog({type: "success", shop: myshopifyDomain, subject: "Continue with free - Create payment", body: {shopId: shopId, plan: plan, newPayment: newPayment}});

                // Continuing with free plan, now redirect to app
                const { redirect } = await authenticate.admin(request);
                return redirect("/app/new-offer");
            }
            createActivityLog({type: "error", shop: myshopifyDomain, subject: "Continue with free - Shop info not updated", body: shopUpdatedInfo});
            return {
                target: "error",
                message: "something_went_wrong",
                data: [],
            };
        }
        else {
            createActivityLog({type: "error", shop: myshopifyDomain, subject: "Continue with free - Plan not found"});
        }
        return {
            target: "error",
            message: "something_went_wrong",
        };
    } catch(error) {
        createActivityLog({type: "error", subject: "Continue with free - catch", body: error});
        return {
            target: "error",
            message: "something_went_wrong",
            data: error,
        };
    }
}

export default function Welcome() {
    const { t } = useTranslation();
    const loaderData = useLoaderData() || {};
    const actionData = useActionData() || {};
    const submit     = useSubmit();

    const shop = loaderData?.shop;

    const continueWithFree = () => {
        submit({ shopId: shop.id, myshopifyDomain: shop.myshopifyDomain }, {method: "POST"});
    }

    if (actionData) {
        if (actionData.target == "error") {
            shopify.toast.show(t(actionData.message), { isError: true });
        }
    }

    return (
        <Bleed>
            <Page fullWidth>
                <Card>
                    <EmptyState
                        heading={ t("holistic_solution_welcome") }
                        action={{ content: t("continue_with_free"), onClick: () => continueWithFree() }}
                        secondaryAction={{ content: t("choose_a_plan"), url: "/app/plans" }}
                        image="/images/welcome.png"
                    >
                        <p>{ t("comprehensive_solution_message") }</p>
                    </EmptyState>
                </Card>
            </Page>
        </Bleed>
    );
}