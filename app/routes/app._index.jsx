import { Link, useActionData, useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import { Bleed, BlockStack, Box, Button, Card, InlineGrid, SkeletonBodyText, Text, Page, Grid, Tooltip, IndexTable, Badge, SkeletonDisplayText, EmptySearchResult, Banner, Select, InlineStack, Icon, Thumbnail, Divider, SkeletonTabs, Spinner, ButtonGroup, MediaCard, Pagination, SkeletonThumbnail } from "@shopify/polaris";
import { PlusIcon, ListBulletedIcon, ArrowDownIcon, ArrowUpIcon, ArrowRightIcon } from "@shopify/polaris-icons";
import { useEffect, useState } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { extractIdFromShopifyUrl, getFormattedDateTime, createActivityLog } from "../libs/helpers";
import { Trans, useTranslation } from "react-i18next";

export const loader = async ({ request }) => {
    const { admin, session } = await authenticate.admin(request);
    // Get current shops info
	const response = await admin.graphql(
		`#graphql
        query mainQuery {
            shop {
                myshopifyDomain
                timezoneOffsetMinutes
                primaryDomain {
                    url
                }
            }
        }`
	);
	const responseJson = await response.json();
	const shopInfo = await prisma.shops.findFirst({
		select: {
			id: true,
			discounts: {
				select: {
					id: true,
					title: true,
					type: true,
					status: true,
					discountId: true,
					startsAt: true,
					endsAt: true,
					createdAt: true,
					updatedAt: true,
				},
                where: {
                    deletedAt: null,
                }
			}
		},
		where: {
			myshopifyDomain: responseJson.data.shop.myshopifyDomain,
		},
	});

    try {
        const themeData = await admin.rest.resources.Theme.all({ session: session, role: 'main', fields: 'id' });
        const settings_data = await admin.rest.resources.Asset.all({
            session: session,
            theme_id: themeData?.data[0]?.id,
            asset: {"key": "templates/product.json"},
        });

        /**
         * * Detect if the "Display Discount Info" app block is missing on the product page
         * TODO: Initialize a variable to track if the app block is missing
         * TODO: Parse the settings data value from the settings_data object
         * TODO: Get the active blocks from the parsed settings data value
         * TODO: Iterate through each block object
         * TODO: Check if the current block has a "type" property and if it includes the specific app block ID
         * TODO: If a match is found, that means this block added to the thmem, so set appBlockMissing to false and exit the loop
         * TODO: After the loop, appBlockMissing will indicate whether the app block was found or not
         */
        let appBlockMissing = true;
        const settings_data_value = JSON.parse(settings_data?.data[0]?.value);
        const active_blocks = settings_data_value?.sections?.main?.blocks;
        for (const key in active_blocks) {
            if (active_blocks[key].type && active_blocks[key].type.includes(import.meta.env.VITE_DISCOUNT_INFO_APP_BLOCK_ID)) {
                appBlockMissing = false;
                break;
            }
        }

        const dashboardBanners = await prisma.dashboardBanners.findMany({
            where: {
                status: "ACTIVE",
                validity: {
                    gte: new Date(),
                }
            },
            orderBy: {
                serial: "asc",
            }
        });

        const recommendedApps = await prisma.recommendedApps.findMany({
            where: {
                status: "ACTIVE",
                validity: {
                    gte: new Date(),
                }
            },
            orderBy: {
                serial: "asc",
            }
        });

        const ourArticles = await prisma.ourArticles.findMany({
            where: {
                status: "ACTIVE",
            },
            orderBy: {
                serial: "asc",
            },
        });

        const youtubeVideos = await prisma.youtubeVideos.findMany({
            where: {
                status: "ACTIVE",
                id: {
                    gt: 1,
                }
            },
            orderBy: {
                serial: "asc",
            },
        });


        return {
            target: "shopInfo",
            message: "Success",
            data: {
                shopInfo: shopInfo,
                timezoneOffsetMinutes: responseJson.data.shop.timezoneOffsetMinutes,
                shopUrl: responseJson.data.shop.primaryDomain.url,
                quantityDiscountFID: import.meta.env.VITE_QUANTITY_DISCOUNT_FUNCTION_ID,
                priceDiscountFID: import.meta.env.VITE_PRICE_DISCOUNT_FUNCTION_ID,
                discountInfoABID: import.meta.env.VITE_DISCOUNT_INFO_APP_BLOCK_ID,
                appBlockMissing: appBlockMissing,
                dashboardBanners: dashboardBanners,
                recommendedApps: recommendedApps,
                ourArticles: ourArticles,
                youtubeVideos: youtubeVideos,
            },
        };
    } catch (error) {
        createActivityLog({type: "error", shop: responseJson?.data?.shop?.myshopifyDomain || "shop", subject: "Dashboard data", body: error});
        return {
            target: "error",
            message: "something_went_wrong",
            data: {},
        };
    }
};

export const action = async ({ request }) => {
    const formData = await request.formData();
    const target = formData.get("target");
    const shopId = formData.get("shopId") || "";

    if(target == "recent-discounts") {
        const discountType = formData.get("discountType") || "";

        const discounts = await prisma.discounts.findMany({
            select: {
                id: true,
                title: true,
                type: true,
                status: true,
                discountId: true,
                startsAt: true,
                endsAt: true,
                createdAt: true,
                updatedAt: true,
            },
            where: {
                shopId: parseInt(shopId),
                type: discountType == "all" ? undefined : discountType,
                deletedAt: null
            }
        });
        return {
            target: target,
            message: "Success",
            data: {
                discounts: discounts
            }
        };
    }
    else if(target == "product-rank") {
        const rankType = formData.get("rankType") || "";
        const rankDuration = formData.get("rankDuration") || "";

        return {
            target: target,
            message: "Success",
            data: {}
        };
    }
    else if(target == "our-articles") {
        const newPage = formData.get("newPage") || 1;
        const skip = 4 * (parseInt(newPage) - 1);

        const ourArticles = await prisma.ourArticles.findMany({
            where: {
                status: "ACTIVE",
            },
            orderBy: {
                serial: "asc",
            },
            skip: skip,
            take: 4,
        });

        return {
            target: target,
            message: "Success",
            data: {
                ourArticles: ourArticles
            }
        };
    }

    return {
        target: "error",
        message: "Error",
        data: null
    };
}

export default function Index() {
    const { t } = useTranslation();
	const loaderData = useLoaderData();
    const actionData = useActionData();
    const navigate = useNavigate();
    const submit = useSubmit();

	const [pageLoader, setPageLoader] = useState(true);
	const [discountLoader, setDiscountLoader] = useState(false);
	const [productRankLoader, setProductRankLoader] = useState(false);
	const [articleLoader, setArticlesLoader] = useState(false);

    const timezoneOffsetMinutes = loaderData.data.timezoneOffsetMinutes;

	const shopUrl =	loaderData?.data?.shopUrl || "";
	const discountInfoABID = loaderData?.data?.discountInfoABID || "";
	const priceDiscountFunctionId = loaderData?.data?.priceDiscountFID || "";
	const quantityDiscountFunctionId = loaderData?.data?.quantityDiscountFID || "";

	const [shopInfo, setShopInfo] =	useState();
	const [appBlockMissing, setAppBlockMissing] = useState(false);
    const [revenueDurationSelected, setRevenueDurationSelected] = useState("30days");
    const [saleDurationSelected, setSaleDurationSelected] = useState("30days");
    const [orderDurationSelected, setOrderDurationSelected] = useState("1days");
    const [discountTypeSelected, setDiscountTypeSelected] = useState("all");
	const [recentDiscounts, setRecentDiscounts] =	useState();
	const [dashboardBanners, setDashboardBanners] =	useState(loaderData?.data?.dashboardBanners);
	const [recommendedApps, setRecommendedApps] =	useState(loaderData?.data?.recommendedApps);
    const [productRankTypeSelected, setProductRankTypeSelected] = useState("MostSelling");
    const [productRankDurationSelected, setProductRankDurationSelected] = useState(1);
    const [rankedProducts, setRankedProducts] = useState([]);
    const [ourArticles, setOurArticles] = useState(loaderData?.data?.ourArticles?.slice(0, 4));
    const [ourArticlesCount, setOurArticlesCount] = useState(loaderData?.data?.ourArticles?.length);
    const [ourArticlesPage, setOurArticlesPage] = useState(1);
    const [youtubeVideos, setYoutubeVideos] = useState(loaderData?.data?.youtubeVideos);

    const durationOptions = [
        {label: t("today"), value: "1days", vs: t("vs_yesterday")},
        {label: t("last_7_days"), value: "7days", vs: t("vs_previous_7_days")},
        {label: t("last_15_days"), value: "15days", vs: t("vs_previous_15_days")},
        {label: t("last_30_days"), value: "30days", vs: t("vs_previous_30_days")},
        {label: t("all_time"), value: "all", vs: ""},
    ];

    const discountsOptions = [
        {id: 0, label: t("all"), value: "all"},
        {id: 1, label: t("quantity_discount"), value: "QUANTITY_DISCOUNT"},
        {id: 2, label: t("price_discount"), value: "PRICE_DISCOUNT"},
    ];

    const productRankTypeOptions = [
        {label: t("most_selling"), value: "MostSelling"},
        {label: t("top_product"), value: "TopProduct"},
        {label: t("top_discount"), value: "TopDiscount"},
    ];

    const handleRevenueDurationSelectChange = (newValue) => setRevenueDurationSelected(newValue);
    const handleSaleDurationSelectChange = (newValue) => setSaleDurationSelected(newValue);
    const handleOrderDurationSelectChange = (newValue) => setOrderDurationSelected(newValue);

    const handleDiscountTypeSelected = (newValue) => {
        setDiscountTypeSelected(newValue);
        setDiscountLoader(true);

        submit({
            target: "recent-discounts",
            shopId: shopInfo.id,
            discountType: newValue,
        }, { method: "POST" });
    }

    const handleProductRankTypeSelectChange = (newValue) => {
        setProductRankTypeSelected(newValue);
        getProductRank();
    }

    const handleProductRankDurationSelectChange = (newValue) => {
        setProductRankDurationSelected(newValue);
        getProductRank();
    }

    const getProductRank = () => {
        setProductRankLoader(true);

        submit({
            target: "product-rank",
            shopId: shopInfo.id,
            rankType: productRankTypeSelected,
            rankDuration: productRankDurationSelected,
        }, { method: "POST" });
    }

    const getPaginatedArticles = (direction) => {
        const newPage = direction == "next" ? ourArticlesPage + 1 : ourArticlesPage - 1;
        setArticlesLoader(true);
        setOurArticlesPage(newPage);

        submit({
            target: "our-articles",
            shopId: shopInfo.id,
            newPage: newPage,
        }, { method: "POST" });
    }

    const addBanner = () => {
        setAppBlockMissing(false);
        open(`${shopUrl}/admin/themes/current/editor?template=product&addAppBlockId=${discountInfoABID}/discount_info&target=mainSection`, "_blank");
    };

	useEffect(() => {
        if(loaderData?.target == "error") {
            shopify.toast.show(t(loaderData.message), { isError: true });
        }
		else if (loaderData?.message == "Success" && loaderData?.data) {
			if (loaderData.data.shopInfo) {
				setShopInfo(loaderData.data.shopInfo || {});
				if(loaderData.data.shopInfo.discounts) {
                    const sortedRecords = loaderData.data.shopInfo.discounts.sort((a, b) =>
                        Math.max(new Date(b.updatedAt).getTime(), new Date(b.createdAt).getTime()) -
                        Math.max(new Date(a.updatedAt).getTime(), new Date(a.createdAt).getTime())
                    ).slice(0, 5);
					setRecentDiscounts(sortedRecords);
				}
			}
			if (loaderData.data.appBlockMissing) {
				setAppBlockMissing(loaderData.data.appBlockMissing);
			}

			if(pageLoader) {
				setPageLoader(false);
			}
		}
	}, []);

    useEffect(() => {
        if(discountLoader) {
            if(actionData?.target == "recent-discounts") {
                const sortedRecords = actionData?.data?.discounts?.sort((a, b) =>
                    Math.max(new Date(b.updatedAt).getTime(), new Date(b.createdAt).getTime()) -
                    Math.max(new Date(a.updatedAt).getTime(), new Date(a.createdAt).getTime())
                ).slice(0, 5);
                setRecentDiscounts(sortedRecords);
            }
            setDiscountLoader(false);
        }
        if(productRankLoader) {
            if(actionData?.target == "product-rank") {
                console.log("HI");
            }
            setProductRankLoader(false);
        }
        if(articleLoader) {
            if(actionData?.target == "our-articles" && actionData?.data?.ourArticles) {
                setOurArticles(actionData?.data?.ourArticles);
            }
            setArticlesLoader(false);
        }
	}, [actionData]);

	return (
		<BlockStack>
			<Bleed>
				{pageLoader ? (
					<Page fullWidth>
                        <Card roundedAbove="sm">
                            <BlockStack gap={600}>
                                <SkeletonDisplayText size="small" maxWidth="150px" />
                                <SkeletonBodyText lines={1} />
                            </BlockStack>
                        </Card>
						<Box background="bg-surface-selected" paddingBlock={400} />
						<Grid>
							<Grid.Cell columnSpan={{ xs: 6, md: 3 }}>
								<Card roundedAbove="sm">
                                    <BlockStack gap={300}>
                                        <SkeletonTabs fitted />
                                        <SkeletonDisplayText size="extraLarge" />
                                        <SkeletonTabs />
                                    </BlockStack>
								</Card>
							</Grid.Cell>
							<Grid.Cell columnSpan={{ xs: 6, md: 3 }}>
								<Card roundedAbove="sm">
                                    <BlockStack gap={300}>
                                        <SkeletonTabs fitted />
                                        <SkeletonDisplayText size="extraLarge" />
                                        <SkeletonTabs />
                                    </BlockStack>
								</Card>
							</Grid.Cell>
							<Grid.Cell columnSpan={{ xs: 6, md: 3 }}>
								<Card roundedAbove="sm">
                                    <BlockStack gap={300}>
                                        <SkeletonTabs fitted />
                                        <SkeletonDisplayText size="extraLarge" />
                                        <SkeletonTabs />
                                    </BlockStack>
								</Card>
							</Grid.Cell>
							<Grid.Cell columnSpan={{ xs: 6, md: 3 }}>
								<Card roundedAbove="sm">
                                    <BlockStack gap={300}>
                                        <SkeletonTabs fitted />
                                        <SkeletonDisplayText size="extraLarge" />
                                        <SkeletonTabs />
                                    </BlockStack>
								</Card>
							</Grid.Cell>
						</Grid>
						<Box background="bg-surface-selected" paddingBlock={400} />
						<BlockStack gap={200}>
							<SkeletonDisplayText maxWidth="320px" />
							<Card roundedAbove="sm">
								<SkeletonBodyText lines={12} />
							</Card>
						</BlockStack>
						<Box background="bg-surface-selected" paddingBlock={400} />
                        <BlockStack gap={400}>
                            <SkeletonDisplayText maxWidth="320px" />
                            <Grid>
                                <Grid.Cell columnSpan={{ xs: 6, lg: 8 }}>
                                    <BlockStack gap={600} inlineAlign="stretch">
                                        <Grid>
                                            {[...Array(6)].map((item, i) => (
                                            <Grid.Cell columnSpan={{ xs: 6, md: 4 }} key={i}>
                                                <Card roundedAbove="sm">
                                                    <BlockStack gap={400} inlineAlign="stretch">
                                                        <SkeletonThumbnail size="medium" />
                                                        <SkeletonDisplayText />
                                                        <SkeletonBodyText lines={4} />
                                                    </BlockStack>
                                                </Card>
                                            </Grid.Cell>
                                            ))}
                                        </Grid>
                                    </BlockStack>
                                </Grid.Cell>
                                <Grid.Cell columnSpan={{ xs: 6, lg: 4 }}>
                                    <Card roundedAbove="sm">
                                        <Box minHeight="24rem">
                                            <BlockStack gap={600}>
                                                <SkeletonDisplayText size="large" />
                                                <SkeletonBodyText lines={20} />
                                            </BlockStack>
                                        </Box>
                                    </Card>
                                </Grid.Cell>
                            </Grid>
                        </BlockStack>
						<Box background="bg-surface-selected" paddingBlock={400} />
                        <BlockStack gap={400}>
                            <SkeletonDisplayText maxWidth="320px" />
                            <Grid>
                                <Grid.Cell columnSpan={{ xs: 6, lg: 8 }}>
                                    <BlockStack gap={600} inlineAlign="stretch">
                                        <Grid>
                                            {[...Array(4)].map((item, i) => (
                                            <Grid.Cell columnSpan={{ xs: 6, md: 6 }} key={i}>
                                                <Card roundedAbove="sm">
                                                    <BlockStack gap={400} inlineAlign="stretch">
                                                        <SkeletonThumbnail size="medium" />
                                                        <SkeletonDisplayText />
                                                        <SkeletonBodyText lines={4} />
                                                    </BlockStack>
                                                </Card>
                                            </Grid.Cell>
                                            ))}
                                        </Grid>
                                    </BlockStack>
                                </Grid.Cell>
                                <Grid.Cell columnSpan={{ xs: 6, lg: 4 }}>
                                    <Card roundedAbove="sm">
                                        <Box minHeight="24rem">
                                            <BlockStack gap={600}>
                                                <SkeletonDisplayText size="large" />
                                                <SkeletonBodyText lines={20} />
                                            </BlockStack>
                                        </Box>
                                    </Card>
                                </Grid.Cell>
                            </Grid>
                        </BlockStack>
					</Page>
				) : (
					<Page fullWidth>
                        <BlockStack gap={1000}>
                            <BlockStack>
                                {appBlockMissing && (
                                    <Banner
                                        title={t("attention")}
                                        tone="warning"
                                        action={{content: t("add_app_block_now"), onAction: () => addBanner()}}
                                    >
                                        <p>
                                            <Trans i18nKey="show_discounts_app_block_to_your_theme_message">
                                                In order to show discount information on product page, you need to add the <strong>Show discounts</strong> app block to your theme.
                                            </Trans>
                                        </p>
                                    </Banner>
                                )}
                                {dashboardBanners.map((banner, index) => (
                                    <Banner tone={banner.tone.toLowerCase()} title={banner.title} onDismiss={() => {}} key={index}>
                                        <p>{banner.description}</p>
                                    </Banner>
                                ))}
                            </BlockStack>
                            {/* <Grid>
                                <Grid.Cell columnSpan={{ xs: 6, md: 3, lg: 3 }}>
                                    <Card roundedAbove="sm">
                                        <Box minHeight="8rem">
                                            <BlockStack gap={400}>
                                                <InlineStack align="space-between" blockAlign="center" wrap={false}>
                                                    <Text variant="headingMd" as="h5">{ t("total_revenue") }</Text>
                                                    <Select
                                                        options={durationOptions}
                                                        onChange={handleRevenueDurationSelectChange}
                                                        value={revenueDurationSelected}
                                                    />
                                                </InlineStack>
                                                <InlineStack align="space-between">
                                                    <BlockStack gap={400}>
                                                        <Text variant="heading2xl" as="h3">$6020</Text>
                                                        {revenueDurationSelected != "all" && (
                                                        <InlineStack gap={200} blockAlign="center">
                                                            <Badge tone="critical">
                                                                <InlineStack blockAlign="center">
                                                                    <Icon source={ArrowDownIcon} tone="base" />
                                                                    <Text>10%</Text>
                                                                </InlineStack>
                                                            </Badge>
                                                            <Text>{durationOptions.find(option => option.value == revenueDurationSelected).vs}</Text>
                                                        </InlineStack>
                                                        )}
                                                    </BlockStack>
                                                </InlineStack>
                                            </BlockStack>
                                        </Box>
                                    </Card>
                                </Grid.Cell>
                                <Grid.Cell columnSpan={{ xs: 6, md: 3, lg: 3 }}>
                                    <Card roundedAbove="sm">
                                        <Box minHeight="8rem">
                                            <BlockStack gap={400}>
                                                <InlineStack align="space-between" blockAlign="center" wrap={false}>
                                                    <Text variant="headingMd" as="h5">{ t("total_sale") }</Text>
                                                    <Select
                                                        options={durationOptions}
                                                        onChange={handleSaleDurationSelectChange}
                                                        value={saleDurationSelected}
                                                    />
                                                </InlineStack>
                                                <InlineStack align="space-between">
                                                    <BlockStack gap={400}>
                                                        <Text variant="heading2xl" as="h3">$6020</Text>
                                                        {saleDurationSelected != "all" && (
                                                        <InlineStack gap={200} blockAlign="center">
                                                            <Badge tone="critical">
                                                                <InlineStack blockAlign="center">
                                                                    <Icon source={ArrowDownIcon} tone="base" />
                                                                    <Text>10%</Text>
                                                                </InlineStack>
                                                            </Badge>
                                                            <Text>{durationOptions.find(option => option.value == saleDurationSelected).vs}</Text>
                                                        </InlineStack>
                                                        )}
                                                    </BlockStack>
                                                </InlineStack>
                                            </BlockStack>
                                        </Box>
                                    </Card>
                                </Grid.Cell>
                                <Grid.Cell columnSpan={{ xs: 6, md: 3, lg: 3 }}>
                                    <Card roundedAbove="sm">
                                        <Box minHeight="8rem">
                                            <BlockStack gap={400}>
                                                <InlineStack align="space-between" blockAlign="center" wrap={false}>
                                                    <Text variant="headingMd" as="h5">{ t("total_order") }</Text>
                                                    <Select
                                                        options={durationOptions}
                                                        onChange={handleOrderDurationSelectChange}
                                                        value={orderDurationSelected}
                                                    />
                                                </InlineStack>
                                                <InlineStack align="space-between">
                                                    <BlockStack gap={400}>
                                                        <Text variant="heading2xl" as="h3">128</Text>
                                                        {orderDurationSelected != "all" && (
                                                        <InlineStack gap={200} blockAlign="center">
                                                            <Badge tone="success">
                                                                <InlineStack blockAlign="center">
                                                                    <Icon source={ArrowUpIcon} tone="base" />
                                                                    <Text>8%</Text>
                                                                </InlineStack>
                                                            </Badge>
                                                            <Text>{durationOptions.find(option => option.value == orderDurationSelected).vs}</Text>
                                                        </InlineStack>
                                                        )}
                                                    </BlockStack>
                                                </InlineStack>
                                            </BlockStack>
                                        </Box>
                                    </Card>
                                </Grid.Cell>
                                <Grid.Cell columnSpan={{ xs: 6, md: 3, lg: 3 }}>
                                    <Card roundedAbove="sm">
                                        <Box minHeight="8rem">
                                            <InlineStack gap={400} align="space-between" blockAlign="center" wrap={false}>
                                                <BlockStack align="space-between" inlineAlign="start" gap={600}>
                                                    <Text variant="headingLg" as="h5">{ t("reach_our_expert_customer_support_team") }</Text>
                                                    <Button variant="tertiary" size="large">
                                                        <InlineStack blockAlign="center" gap={100}>
                                                            <Text>{ t("get_support") }</Text>
                                                            <Icon source={ArrowRightIcon} tone="base" />
                                                        </InlineStack>
                                                    </Button>
                                                </BlockStack>
                                                <img
                                                    src="/images/get_support.png"
                                                    alt="DiscountRay support"
                                                    height={100}
                                                    style={{
                                                        objectFit: 'cover',
                                                        objectPosition: 'center',
                                                    }}
                                                />
                                            </InlineStack>
                                        </Box>
                                    </Card>
                                </Grid.Cell>
                            </Grid> */}
                            <BlockStack gap={400}>
                                <Text variant="headingXl" as="h4">{ t("recent_discount_activities") }</Text>
                                <Card roundedAbove="sm">
                                    <InlineStack gap={200} blockAlign="center">
                                        <Text variant="bodyLg" as="p">{ t("discount_type") }</Text>
                                        <Select
                                            options={discountsOptions}
                                            onChange={handleDiscountTypeSelected}
                                            value={discountTypeSelected}
                                            disabled={discountLoader}
                                        />
                                    </InlineStack>
                                    <Box paddingBlock={200} />
                                    <Divider />
                                    {discountLoader ? (
                                        <Box paddingBlock={3200}>
                                            <InlineStack align="center" blockAlign="stretch">
                                                <Spinner accessibilityLabel="Discount loader" size="large" />
                                            </InlineStack>
                                        </Box>
                                    ) : recentDiscounts.length > 0 ? (
                                        <IndexTable
                                            itemCount={recentDiscounts.length}
                                            headings={[
                                                { title: t("title") },
                                                { title: t("type") },
                                                { title: t("status") },
                                                { title: t("starts_at") },
                                                { title: t("ends_at") }
                                            ]}
                                            selectable={false}
                                        >
                                            {recentDiscounts.map((discount, index) => {
                                                const { id, title, status, type, discountId, startsAt, endsAt  } = discount;
                                                const discount_type = type == "QUANTITY_DISCOUNT" ? "quantity-discount" : "price-discount";
                                                const function_id = type == "QUANTITY_DISCOUNT" ? quantityDiscountFunctionId : priceDiscountFunctionId;
                                                const current_gid = extractIdFromShopifyUrl(discountId);
                                                const url = `/app/${discount_type}/${function_id}/${current_gid}?headback=home`;
                                                return (
                                                    <IndexTable.Row id={id} key={id} position={index} onNavigation={() => navigate(url)}>
                                                        <IndexTable.Cell>
                                                            <Box paddingBlock={200} data-primary-link data-polaris-unstyled>
                                                                <Text fontWeight="semibold">{title}</Text>
                                                            </Box>
                                                        </IndexTable.Cell>
                                                        <IndexTable.Cell>{type == "QUANTITY_DISCOUNT" ? t("quantity_discount") : t("price_discount") }</IndexTable.Cell>
                                                        <IndexTable.Cell>
                                                        {status == "ACTIVE" ? (
                                                            <Badge tone="success">{ t("active") }</Badge>
                                                        ) : status == "EXPIRED" ? (
                                                            <Badge tone="critical">{ t("expired") }</Badge>
                                                        ) : (
                                                            <Badge tone="attention">{ t("scheduled") }</Badge>
                                                        )}
                                                        </IndexTable.Cell>
                                                        <IndexTable.Cell>{getFormattedDateTime({timezoneOffset: timezoneOffsetMinutes, dateString: startsAt})}</IndexTable.Cell>
                                                        <IndexTable.Cell>{endsAt ? getFormattedDateTime({timezoneOffset: timezoneOffsetMinutes, dateString: endsAt}) : "-"}</IndexTable.Cell>
                                                    </IndexTable.Row>
                                                )
                                            })}
                                        </IndexTable>
                                    ) : (
                                        <Box padding={400} width="100%">
                                            <EmptySearchResult
                                                title={ t("no_discounts") }
                                                description={ t("no_recent_discounts") }
                                                withIllustration
                                            />
                                        </Box>
                                    )}
                                </Card>
                                <InlineStack align="center">
                                    <Button variant="primary" size="large" url={`/app/offer-list?at=${discountsOptions.find(option => option.value == discountTypeSelected).id}`}>{ t("see_all_discounts") }</Button>
                                </InlineStack>
                            </BlockStack>
                            <BlockStack gap={400}>
                                <Text variant="headingXl" as="h4">{ t("our_recommended_shopify_apps") }</Text>
                                <Grid>
                                    <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                                        <BlockStack gap={600} inlineAlign="center">
                                            <Grid>
                                                {recommendedApps.map((app, index) => (
                                                <Grid.Cell columnSpan={{ xs: 6, md: 3 }} key={index}>
                                                    <Card roundedAbove="sm">
                                                        <Box minHeight="16rem">
                                                            <BlockStack gap={400}>
                                                                <Thumbnail size="large" source={app.image} alt={app.name} />
                                                                <Button variant="plain" textAlign="left" url={app.url} target="_blank">
                                                                    <Text variant="headingLg" as="h5">{app.name}</Text>
                                                                </Button>
                                                                <Text>{app.description}</Text>
                                                            </BlockStack>
                                                        </Box>
                                                    </Card>
                                                </Grid.Cell>
                                                ))}
                                            </Grid>
                                            <Button variant="primary" size="large" url="https://discountray.com/partners" target="_blank">{ t("see_all_apps") }</Button>
                                        </BlockStack>
                                    </Grid.Cell>
                                    {/* <Grid.Cell columnSpan={{ xs: 6, lg: 4 }}>
                                        <Card roundedAbove="sm">
                                            <Box minHeight="30rem">
                                                <BlockStack gap={600}>
                                                    <InlineStack align="space-between" wrap={false}>
                                                        <Text variant="headingLg" as="h5">{ t("product_selling_ranks_using_discountray") }</Text>
                                                        <Select
                                                            options={productRankTypeOptions}
                                                            onChange={handleProductRankTypeSelectChange}
                                                            value={productRankTypeSelected}
                                                        />
                                                    </InlineStack>
                                                    <ButtonGroup variant="segmented" fullWidth noWrap>
                                                        <Button size="large" pressed={productRankDurationSelected === 0} onClick={() => handleProductRankDurationSelectChange(0)}>{ t("today") }</Button>
                                                        <Button size="large" pressed={productRankDurationSelected === 1} onClick={() => handleProductRankDurationSelectChange(1)}>{ t("this_week") }</Button>
                                                        <Button size="large" pressed={productRankDurationSelected === 2} onClick={() => handleProductRankDurationSelectChange(2)}>{ t("this_month") }</Button>
                                                    </ButtonGroup>
                                                    {productRankLoader ? (
                                                            <Box paddingBlock={3200}>
                                                                <InlineStack align="center" blockAlign="stretch">
                                                                    <Spinner accessibilityLabel="Discount loader" size="large" />
                                                                </InlineStack>
                                                            </Box>
                                                        ) : rankedProducts.length > 0 ? (
                                                            <IndexTable
                                                                headings={[]}
                                                                itemCount={rankedProducts.length}
                                                                selectable={false}
                                                            >
                                                                {rankedProducts.map((product, index) => (
                                                                    <IndexTable.Row id={index} key={index} position={index}>
                                                                        <IndexTable.Cell>
                                                                            <Thumbnail size="small" source={product.image} alt={product.name} />
                                                                        </IndexTable.Cell>
                                                                        <IndexTable.Cell>
                                                                            <Box paddingBlock={400}>
                                                                                <Text variant="bodyMd" as="p">{product.name}</Text>
                                                                            </Box>
                                                                        </IndexTable.Cell>
                                                                        <IndexTable.Cell>
                                                                            <Text variant="bodyMd" fontWeight="bold" as="span">{product.sells}</Text>
                                                                        </IndexTable.Cell>
                                                                        <IndexTable.Cell>
                                                                            <Badge tone={product.change >= 0 ? "success" : "critical"}>
                                                                                <InlineStack blockAlign="center" wrap={false}>
                                                                                    <Icon source={product.change >= 0 ? ArrowUpIcon : ArrowDownIcon} tone="base" />
                                                                                    <Text>{product.change}%</Text>
                                                                                </InlineStack>
                                                                            </Badge>
                                                                        </IndexTable.Cell>
                                                                    </IndexTable.Row>
                                                                ))}
                                                            </IndexTable>
                                                        ) : (
                                                            <Box padding={400} width="100%" minHeight="30rem">
                                                                <EmptySearchResult
                                                                    title={ t("no_results_found") }
                                                                    withIllustration
                                                                />
                                                            </Box>
                                                        )}
                                                </BlockStack>
                                            </Box>
                                        </Card>
                                    </Grid.Cell> */}
                                </Grid>
                            </BlockStack>
                            <Grid>
                                <Grid.Cell columnSpan={{ xs: 6, lg: 8 }}>
                                    <Card roundedAbove="sm">
                                        <BlockStack gap={400}>
                                            <Text variant="headingXl" as="h4">{ t("our_articles") }</Text>
                                            <Divider />
                                            {articleLoader ? (
                                                <Box paddingBlock={3200}>
                                                    <InlineStack align="center" blockAlign="stretch">
                                                        <Spinner accessibilityLabel="Discount loader" size="large" />
                                                    </InlineStack>
                                                </Box>
                                            ) : ourArticles.length > 0 ? (
                                                <Grid>
                                                    {ourArticles.map((article, index) => (
                                                    <Grid.Cell columnSpan={{ xs: 6, lg: 6 }} key={index}>
                                                        <Card padding={0}>
                                                            <InlineGrid columns={2}>
                                                                <img
                                                                    alt={article.title}
                                                                    width="100%"
                                                                    height="100%"
                                                                    style={{
                                                                        objectFit: 'cover',
                                                                        objectPosition: 'center',
                                                                    }}
                                                                    src={article.image}
                                                                />
                                                                <Box padding={400} minHeight="15rem">
                                                                    <BlockStack gap={100} inlineAlign="start">
                                                                        <Text tone="subdued">{getFormattedDateTime({timezoneOffset: timezoneOffsetMinutes, dateString: article.date})}</Text>
                                                                        <InlineStack gap={100}>
                                                                            {article.categories.split(',').map((category, index) => (
                                                                            <Badge size="small" key={index}>{category}</Badge>
                                                                            ))}
                                                                        </InlineStack>
                                                                        <Text variant="headingLg" as="h5">{article.title}</Text>
                                                                        <Box paddingBlock={100} />
                                                                        <Button variant="tertiary" size="large" url={article.url} target="_blank">
                                                                            <InlineStack blockAlign="center" gap={100}>
                                                                                <Text>{ t("read_more") }</Text>
                                                                                <Icon source={ArrowRightIcon} tone="base" />
                                                                            </InlineStack>
                                                                        </Button>
                                                                    </BlockStack>
                                                                </Box>
                                                            </InlineGrid>
                                                        </Card>
                                                    </Grid.Cell>
                                                    ))}
                                                </Grid>
                                            ) : (
                                                <Box padding={400} width="100%" minHeight="32rem">
                                                    <EmptySearchResult
                                                        title={ t("no_results_found") }
                                                        withIllustration
                                                    />
                                                </Box>
                                            )}
                                            <Box paddingBlock={200}>
                                                <InlineStack align="center">
                                                    <Pagination
                                                        hasPrevious
                                                        previousTooltip={ t("previous") }
                                                        onPrevious={() => ourArticlesPage > 1 ? getPaginatedArticles("previous") : {}}
                                                        label={ t("page_current_of_total", {current: ourArticlesPage, total: Math.ceil(ourArticlesCount / 4)}) }
                                                        hasNext
                                                        nextTooltip={ t("next") }
                                                        onNext={() => (Math.ceil(ourArticlesCount / 4) > ourArticlesPage) ? getPaginatedArticles("next") : {}}
                                                    />
                                                </InlineStack>
                                            </Box>
                                        </BlockStack>
                                    </Card>
                                </Grid.Cell>
                                <Grid.Cell columnSpan={{ xs: 6, lg: 4 }}>
                                    <Card roundedAbove="sm">
                                        <BlockStack gap={400}>
                                            <Button variant="tertiary" textAlign="left" size="large" url="https://www.youtube.com/@eFoli-LLC" target="_blank">
                                                <InlineStack blockAlign="center" gap={200}>
                                                    <Thumbnail source="/images/youtube.svg" alt="YouTube logo" />
                                                    <BlockStack>
                                                        <Text variant="headingXl" as="h4">DiscountRay</Text>
                                                        <Text>{ t("a_holistic_solution_for_all_your_discounts") }</Text>
                                                    </BlockStack>
                                                </InlineStack>
                                            </Button>
                                            {youtubeVideos[0]?.video_id && (
                                                <>
                                                    <Card padding={0}>
                                                        <iframe id="ytplayer" type="text/html" width="100%" height="260" style={{border:'none',marginBottom:'-5px'}} src={`https://www.youtube.com/embed/${youtubeVideos[0].video_id}?controls=0&fs=0&iv_load_policy=3`}></iframe>
                                                    </Card>
                                                    <Text variant="headingLg" as="h5">{youtubeVideos[0].title}</Text>
                                                    <Box paddingBlock={100} />
                                                </>
                                            )}
                                            {youtubeVideos[1]?.video_id && (
                                                <>
                                                    <Text variant="bodyLg" as="p">
                                                        <Text tone="subdued" as="span">{ t("featured_video") } </Text>
                                                        <Text as="span">{youtubeVideos[1].title}</Text>
                                                    </Text>
                                                    <Grid>
                                                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                                                            <Card padding={0}>
                                                                <iframe id="ytplayer" type="text/html" width="100%" height="120" style={{border:'none',marginBottom:'-5px'}} src={`https://www.youtube.com/embed/${youtubeVideos[1].video_id}?controls=0&fs=0&iv_load_policy=3`}></iframe>
                                                            </Card>
                                                        </Grid.Cell>
                                                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                                                            <Card padding={0}>
                                                                <Box paddingBlock={1200}>
                                                                    <BlockStack inlineAlign="center">
                                                                        <Button variant="plain" url="https://www.youtube.com/@eFoli-LLC/videos" target="_blank">{ t("see_more") }</Button>
                                                                    </BlockStack>
                                                                </Box>
                                                            </Card>
                                                        </Grid.Cell>
                                                    </Grid>
                                                </>
                                            )}
                                        </BlockStack>
                                    </Card>
                                </Grid.Cell>
                            </Grid>
                            <Box minHeight="10rem" />
                        </BlockStack>
					</Page>
				)}
			</Bleed>
		</BlockStack>
	);
}
