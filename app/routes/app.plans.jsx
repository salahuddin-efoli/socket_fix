import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import { Badge, Bleed, BlockStack, Box, Button, ButtonGroup, Card, Divider, EmptyState, Grid, Icon, IndexTable, InlineGrid, InlineStack, List, Page, SkeletonBodyText, SkeletonDisplayText, Tabs, Text, Thumbnail } from "@shopify/polaris";
import { CheckCircleIcon, PlusIcon, MinusIcon, StarIcon, StarFilledIcon } from "@shopify/polaris-icons";
import { useEffect, useState } from 'react';
import prisma from "../db.server";
import { calculateRemainingTrialDays, createActivityLog } from "../libs/helpers";
import { authenticate } from "../shopify.server";
import { useTranslation } from "react-i18next";
import "../styles/global.css";

export const loader = async ({ request }) => {

    // Get All package plans  from prisma
    const plans = await prisma.plans.findMany();

    const { admin } = await authenticate.admin(request);
    const graphqlQuery = `#graphql
        query shop{
            shop {
                id
                primaryDomain {
                    url
                }
            }
        }
    `;
    const response = await admin.graphql(graphqlQuery, "");
    const shopResponseJson = await response.json();
    const shopUrl = shopResponseJson.data.shop.primaryDomain.url || "";

    const appGraphqlQuery = `#graphql
        query app {
            app {
                handle
            }
        }
    `;
    const appJesponse = await admin.graphql(appGraphqlQuery);
    const appResponseJson = await appJesponse.json();
    const appHandle = appResponseJson.data.app.handle || "";

    // Get shop info from prima storage using shop GID  
    const shop = await prisma.shops.findFirst({ where: { gid: shopResponseJson.data.shop.id } });

    const staticData = {
        discount_percentage: import.meta.env.VITE_ANNUAL_DISCOUNT_PERCENTAGE,
        return_url: `${shopUrl}/admin/apps/${appHandle}/app/purchase-success`,
    }

    return {
        plans: plans,
        shop: shop,
        staticData: staticData,
        allowPlanSubscriptionPayment: import.meta.env.VITE_ALLOW_PLAN_SUBSCRIPTION_PAYMENT,
    }
}

export const action = async ({ params, request }) => {
    const formData = await request.formData();
    const shopId = formData.get("shopId") || "";
    const shopDomain = formData.get("shopDomain") || "";
    const planId = formData.get("planId") || "";
    const planTitle = formData.get("planTitle") || "";
    const planType = formData.get("planType") || "";
    const planPrice = formData.get("planPrice") || "";
    const graphqlQuery = formData.get("graphqlQuery") || "";
    const queryParams = formData.get("queryParams") || "";

    try {
        // Create Subscription mutation 
        const { admin } = await authenticate.admin(request);
        let responseJson = {};
        let returnUrl = "";

        if (planPrice > 0) {
            const response = await admin.graphql(graphqlQuery, JSON.parse(queryParams));
            responseJson = await response.json();
            createActivityLog({ type: "info", shop: shopDomain, subject: "Paid plan so create App Subscription", body: responseJson });
            if (responseJson?.data?.appSubscriptionCreate?.appSubscription?.id) {
                returnUrl = responseJson.data.appSubscriptionCreate?.confirmationUrl;
            } else {
                createActivityLog({ type: "error", shop: shopDomain, subject: "Plan subscription create", body: responseJson, query: graphqlQuery, variables: queryParams });
                return {
                    target: "error",
                    message: "something_went_wrong",
                    data: []
                };
            }
            createActivityLog({ type: "success", shop: shopDomain, subject: "Paid plan so create App Subscription", body: responseJson });
        } else {
            /**
             * * Mutation not need for free plan.
             * TODO: Check if any paid subscriptions exists
             * TODO: If yes the loop through them and cancel them all
             * TODO: Then update shops and payments table
             */
            const subscriptionQuery = `#graphql
                query subscriptions {
                    app {
                        installation {
                            activeSubscriptions {
                                id
                                status
                            }
                        }
                    }
                }
            `;
            const subscriptionResponse = await admin.graphql(subscriptionQuery);
            const subscriptionResponseJson = await subscriptionResponse.json();
            if(subscriptionResponseJson?.data?.app?.installation?.activeSubscriptions?.length > 0) {
                const activeSubscriptions = subscriptionResponseJson.data.app.installation.activeSubscriptions;
                for (let index = 0; index < activeSubscriptions.length; index++) {
                    const subscription = activeSubscriptions[index];
                    const cancellationGraphqlQuery = `#graphql
                        mutation appSubscriptionCancel($id: ID!) {
                            appSubscriptionCancel(id: $id) {
                                userErrors {
                                    field
                                    message
                                }
                                appSubscription {
                                    id
                                    status
                                }
                            }
                        }
                    `;
                    const cancellationQueryParams = {
                        variables: {
                            "id": subscription.id
                        }
                    };

                    const cancellationResponse = await admin.graphql(cancellationGraphqlQuery, cancellationQueryParams);
                    const cancellationResponseJson = await cancellationResponse.json();
                    createActivityLog({type: "info", shop: shopDomain, subject: "App subscription cancel", body: cancellationResponseJson, query: cancellationGraphqlQuery, variables: cancellationQueryParams});
                }
            }

            const shopInfo = await prisma.shops.findFirst({
                where: { id: parseInt(shopId) },
                select: {
                    id: true,
                    trialPeriod: true,
                    trialStartsAt: true
                }
            });

            const remainingTrialPeriod = calculateRemainingTrialDays(shopInfo.trialStartsAt, shopInfo.trialPeriod);

            await prisma.shops.update({
                where: { id: parseInt(shopId) },
                data: {
                    planId: parseInt(planId),
                    planType: planType,
                    planBillingPrice: planPrice,
                    trialStartsAt: new Date().toISOString(),
                    trialPeriod: (remainingTrialPeriod != null && remainingTrialPeriod >= 0) ? remainingTrialPeriod : parseInt(import.meta.env.VITE_TRIAL_PERIOD),
                }
            });
        }

        // After complete mution or updated shops table store plan data in payments table
        if (planPrice == 0 || responseJson?.data?.appSubscriptionCreate?.appSubscription?.id) {
            const discount_percentage = (planType == 'ANNUAL') ? parseFloat(import.meta.env.VITE_ANNUAL_DISCOUNT_PERCENTAGE) : 0;
            await prisma.payments.create({
                data: {
                    shopId: parseInt(shopId),
                    planId: parseInt(planId),
                    planType: planType,
                    planPrice: planPrice,
                    planBillingPrice: planPrice - (planPrice * discount_percentage),
                    response: planPrice > 0 ? JSON.stringify(responseJson) : null,
                    status: planPrice > 0 ? "PENDING" : "ACCEPTED"
                }
            });
            createActivityLog({ type: "success", shop: shopDomain, subject: "Plan subscription create", body: responseJson });
            return {
                target: "success",
                message: "plan_update_success_message",
                url: returnUrl, // This "confirmationUrl" is shopify payment url
                data: {
                    plan: planTitle
                },
            };
        }
        else {
            createActivityLog({ type: "error", shop: shopDomain, subject: "Plan subscription create", body: responseJson, query: graphqlQuery, variables: queryParams });
        }
        return {
            target: "error",
            message: "something_went_wrong",
            url: "",
            data: [],
        };
    } catch (error) {
        createActivityLog({ type: "error", shop: shopDomain, subject: "Plan subscription", body: error });
        return {
            target: "error",
            message: "something_went_wrong",
            data: [],
        };
    }
}

export default function Plans() {
    const { t } = useTranslation();
    const loaderData = useLoaderData() || {};
    const actionData = useActionData() || {};
    const submit = useSubmit();

    const shop = loaderData?.shop;
    const packagePlans = loaderData?.plans;
    const [planFeatures, setPlanFeatures] = useState([]);
    const staticData = loaderData?.staticData;
    const allowPlanSubscriptionPayment = loaderData?.allowPlanSubscriptionPayment || "";

    const [pageLoader, setPageLoader] = useState(true);
    const [selectedTab, setSelectedTab] = useState(shop?.planType == "ANNUAL" ? 1 : 0);
    const [showPlanFeatures, setShowPlanFeatures] = useState(true);
    const [startBtnLoader, setStartBtnLoader] = useState(false);
    const [standardBtnLoader, setStandardBtnLoader] = useState(false);
    const [professionalBtnLoader, setProfessionalBtnLoader] = useState(false);
    const [subscribedToFreePlan, setSubscribedToFreePlan] = useState(false);

    // This method show the content of tab
    const handleTabChange = (selectedTabTabIndex) => setSelectedTab(selectedTabTabIndex);

    // Find out expired Days
    const remainingTrialPeriod = calculateRemainingTrialDays(shop.trialStartsAt, shop.trialPeriod, true);
    const upgrateBtnText = remainingTrialPeriod?.miliseconds > 0 ? t("start_with_free_trial_days") : t("start");

    // This method update shop planId and sotre it in prisma
    const handleSubscriptionsPlan = (plan, planType) => {
        if (plan.id == 1) {
            setStartBtnLoader(true)
        } else if (plan.id == 2) {
            setStandardBtnLoader(true)
        } else {
            setProfessionalBtnLoader(true)
        }

        const plan_price = (planType == 'ANNUAL') ? parseFloat(plan.annualPrice) : parseFloat(plan.monthlyPrice);
        const interval = (planType == 'ANNUAL') ? "ANNUAL" : "EVERY_30_DAYS";
        const discount_percentage = (planType == 'ANNUAL') ? parseFloat(staticData.discount_percentage) : 0;

        const graphqlQuery = `#graphql
                mutation appSubscriptionCreate($lineItems: [AppSubscriptionLineItemInput!]!,  $name: String!, $returnUrl: URL!, $replacementBehavior: AppSubscriptionReplacementBehavior, $test: Boolean, $trialDays: Int) {
                    appSubscriptionCreate(lineItems: $lineItems, name: $name, returnUrl: $returnUrl, replacementBehavior: $replacementBehavior, test: $test, trialDays: $trialDays) {
                        appSubscription {
                            id
                            createdAt
                            currentPeriodEnd
                            name
                            returnUrl
                            status
                            test
                            trialDays
                            lineItems{
                                id
                            }
                        }
                        confirmationUrl
                        userErrors {
                            field
                            message
                        }
                    }
                }`;

        const queryParams = {
            variables: {
                lineItems: [
                    {
                        plan: {
                            appRecurringPricingDetails: {
                                discount: {
                                    durationLimitInIntervals: 1,
                                    value: {
                                        percentage: discount_percentage
                                    }
                                },
                                interval: interval,
                                price: {
                                    amount: plan_price,
                                    currencyCode: "USD",
                                }
                            }
                        }
                    }
                ],
                name: plan.title,
                replacementBehavior: "STANDARD",
                returnUrl: staticData.return_url,
                test: (allowPlanSubscriptionPayment && allowPlanSubscriptionPayment == "YES") ? false : true,
                trialDays: remainingTrialPeriod?.days
            }
        }
        submit({
            shopId: shop.id,
            shopDomain: shop.myshopifyDomain,
            planId: plan.id,
            planTitle: plan.title,
            planType: planType,
            planPrice: plan_price,
            graphqlQuery: graphqlQuery,
            queryParams: JSON.stringify(queryParams)
        }, { method: "POST" });
    }



    const tabs = [
        {
            id: 'monthly-plan',
            content: <Text variant="bodyLg" as="p" fontWeight="bold">{ t("monthly_plan") }</Text>,
            panelID: 'monthly-plan-content-1',
        },
        {
            id: 'annual-plan',
            content: <Text variant="bodyLg" as="p" fontWeight="bold">{ t("annual_plan_with_discount", {percent: parseFloat(staticData?.discount_percentage) * 100}) }</Text>,
            panelID: 'annual-plan-content-1',
        },
    ];

    if (actionData) {
        if(pageLoader) {
            setPageLoader(false);
        }
        if (actionData.target == "error") {
            shopify.toast.show(t(actionData.message), { isError: true });
        }
        else if (actionData.target == "success") {
            if (actionData.url != "") {
                open(actionData.url, '_top');
            }
            else {
                if(!subscribedToFreePlan) {
                    setSubscribedToFreePlan(true);
                }
            }
        }
    }

    return (
        <Bleed>
            {(actionData?.message && subscribedToFreePlan) ? (
                <Page fullWidth>
                    <Card>
                        <EmptyState
                            heading={t(actionData.message, { plan: actionData.data.plan })}
                            action={{ content: t("continue"), url: "/app" }}
                            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                        >
                            <p>{ t("enjoy_app_message") }</p>
                        </EmptyState>
                    </Card>
                </Page>
            ) : (
                <Page fullWidth>
                    <BlockStack gap={200} align="center" inlineAlign="center">
                        <Text variant="heading2xl" as="h3">Ready to start with DiscountRay?</Text>
                        <Text variant="bodyLg" as="p">
                            <Text as="span"tone="subdued">Choose the package that best suits your </Text>
                            <Text as="span" fontWeight="semibold">Business Needs</Text>
                        </Text>
                        <Box paddingBlock={200} />
                        <Box borderWidth="050" borderRadius={300} borderColor="bg-fill-critical" padding={100}>
                            <ButtonGroup variant="segmented">
                                <Button variant={selectedTab == 0 ? "primary" : "tertiary"} size="large" onClick={() => handleTabChange(0)}>Pay monthly</Button>
                                <Button variant={selectedTab == 1 ? "primary" : "tertiary"} size="large" onClick={() => handleTabChange(1)}>Pay yearly (Save 20%)</Button>
                            </ButtonGroup>
                        </Box>
                        <Box paddingBlock={200} />
                        <Box width="100%" paddingInline={{sm: '100', md: '400', lg: '1200', xl: '2400'}}>
                            {selectedTab == 0 ? (
                                <Grid>
                                    {packagePlans?.map((plan, index) => {
                                        const monthlyFeatures = JSON.parse(plan.monthlyFeatures);
                                        return (
                                            <Grid.Cell columnSpan={{ xs: 6, lg: 6, xl: 4 }} key={index}>
                                                <Box>
                                                    <div style={{position: 'relative', top: '18px', zIndex: '2', minHeight: '2rem'}}>
                                                        <InlineStack align="center">
                                                            {plan.id == 3 && (<Badge tone="critical" icon={StarFilledIcon} size="large">Popular</Badge>)}
                                                        </InlineStack>
                                                    </div>
                                                    <Card padding={0}>
                                                        <BlockStack gap={400}>
                                                            <Box paddingInline={800} paddingBlockStart={800}>
                                                                <InlineStack align="space-between">
                                                                    <Text variant="headingXl" as="h4">{plan.title}</Text>
                                                                    {plan.id == 3 && (<Badge tone="critical" icon={StarFilledIcon} size="large">Popular</Badge>)}
                                                                </InlineStack>
                                                                <Text fontWeight="semibold">{monthlyFeatures.target}</Text>
                                                            </Box>
                                                            <Box paddingInline={800} minHeight="4rem">
                                                                <Text tone="subdued">{monthlyFeatures.description}</Text>
                                                            </Box>
                                                            <Box paddingInline={800}>
                                                            {plan.monthlyPrice == 0 ? (
                                                                <Text variant="heading2xl" as="h3">Free</Text>
                                                            ) : (
                                                                <InlineStack blockAlign="baseline" wrap={false}>
                                                                    <Text variant="heading2xl" as="h3">${plan.monthlyPrice}</Text>
                                                                    <Text variant="bodyLg" as="p"> /per month</Text>
                                                                </InlineStack>
                                                            )}
                                                            </Box>
                                                            <Box paddingBlock={50} />
                                                            <Box padding={300} borderBlockStartWidth="025" borderBlockEndWidth="025" borderColor="bg-fill-critical" background="bg-fill-critical-secondary">
                                                                <Text fontWeight="semibold" alignment="center">{monthlyFeatures.freeText}</Text>
                                                            </Box>
                                                            <Box paddingBlock={50} />
                                                            <Box paddingInline={800}>
                                                                <BlockStack gap={400} align="start" inlineAlign="start">
                                                                {monthlyFeatures.features.map((feature, index) => (
                                                                    <InlineStack blockAlign="center" align="start" gap={100} wrap={false} key={index}>
                                                                        <img
                                                                            src="/images/check_icon.svg"
                                                                            width={24}
                                                                            height={24}
                                                                            style={{backgroundColor: 'rgba(255, 248, 219, 1)', borderRadius: '100%'}}
                                                                            alt="Feature check"
                                                                        />
                                                                        <Text variant="bodyLg" as="p">{feature}</Text>
                                                                    </InlineStack>
                                                                ))}
                                                                </BlockStack>
                                                            </Box>
                                                            <Box paddingInline={800} paddingBlock={800}>
                                                                <InlineStack align="center">
                                                                    <Button variant="primary" size="large" loading={plan.id == 1 ? startBtnLoader : plan.id == 2 ? standardBtnLoader : professionalBtnLoader} onClick={() => handleSubscriptionsPlan(plan, "EVERY_30_DAYS")} disabled={(parseInt(shop.planId) == plan.id && shop.planType == "EVERY_30_DAYS") ? true : false}>
                                                                        {(parseInt(shop.planId) == plan.id && shop.planType == "EVERY_30_DAYS") ? t("current") : (shop.planType == "EVERY_30_DAYS" && parseFloat(plan.monthlyPrice) < parseFloat(shop.planBillingPrice)) ? t("downgrade") : upgrateBtnText}
                                                                    </Button>
                                                                </InlineStack>
                                                            </Box>
                                                        </BlockStack>
                                                    </Card>
                                                </Box>
                                            </Grid.Cell>
                                        );
                                    })}
                                </Grid>
                            ) : (
                                <Grid>
                                    {packagePlans.slice(1, 3)?.map((plan, index) => {
                                        const annualFeatures = JSON.parse(plan.annualFeatures);
                                        return (
                                            <Grid.Cell columnSpan={{ xs: 6, lg: 6 }} key={index}>
                                                <Card padding={0}>
                                                    <BlockStack gap={400}>
                                                        <Box paddingInline={800} paddingBlockStart={800}>
                                                            <InlineStack align="space-between">
                                                                <Text variant="headingXl" as="h4">{plan.title}</Text>
                                                                {plan.id == 3 && (<Badge tone="critical" icon={StarFilledIcon} size="large">Popular</Badge>)}
                                                            </InlineStack>
                                                            <Text fontWeight="semibold">{annualFeatures.target}</Text>
                                                        </Box>
                                                        <Box paddingInline={800} minHeight="4rem">
                                                            <Text tone="subdued">{annualFeatures.description}</Text>
                                                        </Box>
                                                        <Box paddingInline={800}>
                                                        {plan.annualPrice == 0 ? (
                                                            <Text variant="heading2xl" as="h3">Free</Text>
                                                        ) : (
                                                            <InlineStack blockAlign="baseline" wrap={false}>
                                                                <Text variant="heading2xl" as="h3">${plan.annualPrice}</Text>
                                                                <Text variant="bodyLg" as="p"> /per year</Text>
                                                            </InlineStack>
                                                        )}
                                                        </Box>
                                                        <Box padding={300} borderBlockStartWidth="025" borderBlockEndWidth="025" borderColor="bg-fill-critical" background="bg-fill-critical-secondary">
                                                            <Text fontWeight="semibold" alignment="center">{annualFeatures.freeText}</Text>
                                                        </Box>
                                                        <Box paddingBlock={50} />
                                                        <Box paddingInline={800}>
                                                            <BlockStack gap={400} align="start" inlineAlign="start">
                                                            {annualFeatures.features.map((feature, index) => (
                                                                <InlineStack blockAlign="start" align="start" gap={100} wrap={false} key={index}>
                                                                    <Box background="bg-surface-caution" borderRadius="full">
                                                                        <Icon source={CheckCircleIcon} tone="critical" />
                                                                    </Box>
                                                                    <Text variant="bodyLg" as="p">{feature}</Text>
                                                                </InlineStack>
                                                            ))}
                                                            </BlockStack>
                                                        </Box>
                                                        <Box paddingInline={800} paddingBlock={800}>
                                                            <InlineStack align="center">
                                                                <Button variant="primary" size="large" loading={plan.id == 2 ? standardBtnLoader : professionalBtnLoader} onClick={() => handleSubscriptionsPlan(plan, "ANNUAL")} disabled={(parseInt(shop.planId) == plan.id && shop.planType == "ANNUAL") ? true : false}>
                                                                    {(parseInt(shop.planId) == plan.id && shop.planType == "ANNUAL") ? t("current") : (shop.planType == "ANNUAL" && parseFloat(plan.annualPrice) < parseFloat(shop.planBillingPrice)) ? t("downgrade") : upgrateBtnText}
                                                                </Button>
                                                            </InlineStack>
                                                        </Box>
                                                    </BlockStack>
                                                </Card>
                                            </Grid.Cell>
                                        );
                                    })}
                                </Grid>
                            )}
                        </Box>
                        <Box paddingBlock={300} />
                        <Box borderWidth="050" borderRadius={300} borderColor="bg-fill-critical" padding={200}>
                            <Button variant="tertiary" size="large" icon={showPlanFeatures ? MinusIcon : PlusIcon} onClick={() => setShowPlanFeatures(!showPlanFeatures)}>
                                {showPlanFeatures ? "Close plan and features" : "Open plan and features"}
                            </Button>
                        </Box>
                        <Box paddingBlock={400} />
                        {showPlanFeatures && (
                        <Box width="100%" paddingInline={{sm: '100', md: '400', lg: '1200', xl: '2400'}}>
                            <Card padding={0}>
                                <Box paddingInline={400}>
                                    <IndexTable
                                        headings={[]}
                                        itemCount={2}
                                        selectable={false}
                                    >
                                        <IndexTable.Row>
                                            <IndexTable.Cell className="packagePlansTableCellFirst">
                                                <img src="/images/DiscountRay.png" alt="DiscountRay logo" width={320} />
                                            </IndexTable.Cell>
                                            {packagePlans?.map((plan, index) => {
                                                const monthlyFeatures = JSON.parse(plan.monthlyFeatures);
                                                return (
                                                    <IndexTable.Cell key={index} className="packagePlansTableCellFirst">
                                                        <Box padding={600}>
                                                            <Box minHeight="2rem">
                                                            {plan.id == 3 && (<Badge tone="critical" icon={StarFilledIcon} size="large">Popular</Badge>)}
                                                            </Box>
                                                            <BlockStack gap={600}>
                                                                <BlockStack gap={200}>
                                                                    <Text variant="headingLg" as="h5">{plan.title}</Text>
                                                                </BlockStack>
                                                                {plan.monthlyPrice == 0 ? (
                                                                    <Text variant="heading2xl" as="h3">Free</Text>
                                                                ) : (
                                                                    <InlineStack blockAlign="baseline" wrap={false}>
                                                                        <Text variant="heading2xl" as="h3">${plan.monthlyPrice}</Text>
                                                                        <Text variant="bodyLg" as="p"> /per month</Text>
                                                                    </InlineStack>
                                                                )}
                                                                <Box minHeight="5rem">
                                                                    <Text tone="subdued">{monthlyFeatures.description}</Text>
                                                                </Box>
                                                                <InlineStack align="center">
                                                                    {selectedTab == 0 ? (
                                                                    <Button variant="primary" size="large" loading={plan.id == 1 ? startBtnLoader : plan.id == 2 ? standardBtnLoader : professionalBtnLoader} onClick={() => handleSubscriptionsPlan(plan, "EVERY_30_DAYS")} disabled={(parseInt(shop.planId) == plan.id && shop.planType == "EVERY_30_DAYS") ? true : false}>
                                                                        {(parseInt(shop.planId) == plan.id && shop.planType == "EVERY_30_DAYS") ? t("current") : (shop.planType == "EVERY_30_DAYS" && parseFloat(plan.monthlyPrice) < parseFloat(shop.planBillingPrice)) ? t("downgrade") : upgrateBtnText}
                                                                    </Button>
                                                                    ) : (
                                                                    <Button variant="primary" size="large" loading={plan.id == 2 ? standardBtnLoader : professionalBtnLoader} onClick={() => handleSubscriptionsPlan(plan, "ANNUAL")} disabled={(parseInt(shop.planId) == plan.id && shop.planType == "ANNUAL") ? true : false}>
                                                                        {(parseInt(shop.planId) == plan.id && shop.planType == "ANNUAL") ? t("current") : (shop.planType == "ANNUAL" && parseFloat(plan.annualPrice) < parseFloat(shop.planBillingPrice)) ? t("downgrade") : upgrateBtnText}
                                                                    </Button>
                                                                    )}
                                                                </InlineStack>
                                                            </BlockStack>
                                                        </Box>
                                                    </IndexTable.Cell>
                                                );
                                            })}
                                        </IndexTable.Row>
                                        {JSON.parse(packagePlans[0].commonFeatures).map((feature, i) => {
                                            return (
                                                <IndexTable.Row key={i}>
                                                    <IndexTable.Cell className="packagePlansTableCell">
                                                        <Box padding={400}>
                                                            <Text variant="bodyLg" as="p">{feature.label}</Text>
                                                        </Box>
                                                    </IndexTable.Cell>
                                                    {packagePlans?.map((plan, j) => {
                                                        const commonFeatures = JSON.parse(plan.commonFeatures);
                                                        return (
                                                            <IndexTable.Cell className="packagePlansTableCell" key={j}>
                                                                <Box padding={400}>
                                                                    <InlineStack align="center">
                                                                    {commonFeatures[i].value == "Yes" ? (
                                                                        <img
                                                                            src="/images/correct_circle.svg"
                                                                            width={24}
                                                                            height={24}
                                                                            alt="Correct circle"
                                                                        />
                                                                    ) : commonFeatures[i].value == "No" ? (
                                                                        <img
                                                                            src="/images/cancel_circle.svg"
                                                                            width={24}
                                                                            height={24}
                                                                            alt="Cancel circle"
                                                                        />
                                                                    ) : (
                                                                        <Text variant="bodyLg" as="p" fontWeight="semibold" alignment="center">{commonFeatures[i].value}</Text>
                                                                    )}
                                                                    </InlineStack>
                                                                </Box>
                                                            </IndexTable.Cell>
                                                        );
                                                    })}
                                                </IndexTable.Row>
                                            );
                                        })}
                                        <IndexTable.Row>
                                            <IndexTable.Cell className="packagePlansTableCellLast">
                                                <Text></Text>
                                            </IndexTable.Cell>
                                            {packagePlans?.map((plan, index) => (
                                            <IndexTable.Cell className="packagePlansTableCellLast" key={index}>
                                                <Box paddingBlock={500}>
                                                    <InlineStack align="center">
                                                        {selectedTab == 0 ? (
                                                        <Button variant="primary" size="large" loading={plan.id == 1 ? startBtnLoader : plan.id == 2 ? standardBtnLoader : professionalBtnLoader} onClick={() => handleSubscriptionsPlan(plan, "EVERY_30_DAYS")} disabled={(parseInt(shop.planId) == plan.id && shop.planType == "EVERY_30_DAYS") ? true : false}>
                                                            {(parseInt(shop.planId) == plan.id && shop.planType == "EVERY_30_DAYS") ? t("current") : (shop.planType == "EVERY_30_DAYS" && parseFloat(plan.monthlyPrice) < parseFloat(shop.planBillingPrice)) ? t("downgrade") : upgrateBtnText}
                                                        </Button>
                                                        ) : (
                                                        <Button variant="primary" size="large" loading={plan.id == 2 ? standardBtnLoader : professionalBtnLoader} onClick={() => handleSubscriptionsPlan(plan, "ANNUAL")} disabled={(parseInt(shop.planId) == plan.id && shop.planType == "ANNUAL") ? true : false}>
                                                            {(parseInt(shop.planId) == plan.id && shop.planType == "ANNUAL") ? t("current") : (shop.planType == "ANNUAL" && parseFloat(plan.annualPrice) < parseFloat(shop.planBillingPrice)) ? t("downgrade") : upgrateBtnText}
                                                        </Button>
                                                        )}
                                                    </InlineStack>
                                                </Box>
                                            </IndexTable.Cell>
                                            ))}
                                        </IndexTable.Row>
                                    </IndexTable>
                                </Box>
                            </Card>
                        </Box>
                        )}
                        <Box minHeight="10rem" />
                    </BlockStack>
                </Page>
            )}
        </Bleed>
    );
}