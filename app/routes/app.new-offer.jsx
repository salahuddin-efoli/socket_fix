import { useEffect, useState } from "react";
import { Link, useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import { BlockStack, Box, Button, Card, Grid, InlineStack, Page, Text, SkeletonBodyText } from "@shopify/polaris";
import { useTranslation } from "react-i18next";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({request}) => {
    const { admin } = await authenticate.admin(request);
    // First get the current shop
    const shopResponse = await admin.graphql(
        `#graphql
        query shop{
            shop {
                id
                name
                myshopifyDomain
            }
        }`
    );
    const shopResponseJson = await shopResponse.json();

    // Extract the shopifyDomain from the response and get the shop info from app DB
    const myshopifyDomain = shopResponseJson.data.shop.myshopifyDomain || "";
    const shop = await prisma.shops.findFirst({
        select: {
            id: true,
            setting: true,
        },
        where: {
            myshopifyDomain: myshopifyDomain
        }
    });

    const setting = await prisma.settings.findFirst({
        select:{
            id: true,
            shopId: true,
            shopVariables: true,
        },
        where: {
            shopId: shop?.id
        },
    });

    const youtubeVideo = await prisma.youtubeVideos.findFirst({
            where: {
                id: 1
            },
    });
    return {
        target: "get-function-id",
        message: "Response data",
        data: {
            quantityDiscountFID: import.meta.env.VITE_QUANTITY_DISCOUNT_FUNCTION_ID,
            priceDiscountFID: import.meta.env.VITE_PRICE_DISCOUNT_FUNCTION_ID,
            shop: shop,
            setting: setting,
            youtubeVideo: youtubeVideo,
        },
    };
};

export const action = async ({ request }) => {
    const formdata = await request.formData();
    const target = formdata.get("target");
    const shopId = parseInt(formdata.get("shopId"));
    const shopVariables = formdata.get("shopVariables");

    try {
        if(target == "how-to-video") {
            // First get the current shop
            const upsertSettings = await prisma.settings.upsert({
                where: {
                    shopId: shopId
                },
                update: {
                    shopVariables: shopVariables,
                },
                create: {
                    shopId: shopId,
                    shopVariables: shopVariables,
                }
            });
            return {
                target: target,
                message: "Success",
                data: upsertSettings,
            };
        }
    } catch (err) {
        return {
            target: "error",
            message: "something_went_wrong",
            data: err,
        };
    }
}

export default function Index() {
    const { t } = useTranslation();
    const submit = useSubmit();
    const [buttonLoader, setButtonLoader] = useState(false);
    const [pageLoader, setPageLoader] = useState(true);
    const loaderData = useLoaderData() || {};
    const actionData = useActionData() || {};
    const [showVideo, setShowVideo] = useState(true);
    const [shopId, setShopId] = useState();

    const [quantityDiscountFunctionId, setQuantityDiscountFunctionId] = useState("");
    const [priceDiscountFunctionId, setPriceDiscountFunctionId] = useState("");
    const [youtubeVideo, setYoutubeVideo] = useState("");

    const handleDoNotShowAgain = () => {
        setButtonLoader(true);
        const shopVariables = {
            how_to_video: 0
        }
        submit({ target: "how-to-video", shopId: shopId, shopVariables: JSON.stringify(shopVariables), }, { method: "POST" });
    }

    useEffect(() => {
        if(loaderData?.data) {
            if(loaderData.data.quantityDiscountFID) {
                setQuantityDiscountFunctionId(loaderData.data.quantityDiscountFID || "");
            }
            if(loaderData.data.priceDiscountFID) {
                setPriceDiscountFunctionId(loaderData.data.priceDiscountFID || "");
            }
            if (loaderData?.data?.setting){
                const shopVariablesSetting = JSON.parse(loaderData.data.setting.shopVariables);
                if (shopVariablesSetting?.how_to_video == 0) {
                    setShowVideo(false);
                }
            }
            if (loaderData?.data?.youtubeVideo) {
                setYoutubeVideo(loaderData?.data?.youtubeVideo)
            }
            if (loaderData?.data?.youtubeVideo) {
                setShopId(loaderData?.data?.shop.id)
            }
            if(pageLoader) {
                setPageLoader(false);
            }
            /**
             * -------------------------------------------------
             * For any new discount start assigning IDs here...
             * -------------------------------------------------
             */
        }
    }, []);

    useEffect(() => {
        if (actionData) {
            if (actionData.target == "error") {
                if (buttonLoader) {
                    setButtonLoader(false);
                }
                shopify.toast.show(t(actionData.message), { isError: true });
            }
            else if (actionData.target == "how-to-video" && actionData.message == "Success") {
                if (buttonLoader) {
                    setShowVideo(false);
                }
                shopify.toast.show(t("settings_saved_successfully"));
            }
        }
    }, [actionData]);

    return (
        <BlockStack>
            <Page>
                {pageLoader ? (
                  <Grid>
                        <Grid.Cell columnSpan={{ xs: 12, sm: 6, md: 6, lg: 8, xl: 8 }}>
                            <BlockStack gap={300}>
                                <Card>
                                    <SkeletonBodyText />
                                </Card>
                                <Box paddingBlock={100} />
                            </BlockStack>
                        </Grid.Cell>
                    </Grid>

                ) : (
                    <>
                      {showVideo &&
                        <Grid>
                            <Grid.Cell columnSpan={{ xs: 12, sm: 6, md: 6, lg: 8, xl: 8 }}>
                              {youtubeVideo?.video_id && (
                                  <BlockStack gap={300}>
                                      <Card padding={600}>
                                          <iframe id="ytplayer" type="text/html" width="100%" height="260" style={{ border: 'none', marginBottom: '-5px' }} src={`https://www.youtube.com/embed/${youtubeVideo.video_id}?controls=0&fs=0&iv_load_policy=3`}></iframe>
                                          <Box paddingBlock={200} />
                                          <Text variant="headingLg" as="h5">{youtubeVideo.title}</Text>
                                          <InlineStack align="end">
                                              <Button onClick={handleDoNotShowAgain} variant="tertiary" loading={buttonLoader}>{t('do_not_show_again')}</Button>
                                          </InlineStack>
                                      </Card>
                                    <Box paddingBlock={100} />
                                  </BlockStack>
                              )}
                            </Grid.Cell>
                        </Grid>
                    }
                    </>
                )}


                <Grid>
                    <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}>
                        <Card sectioned padding={800}>
                            <Box paddingBlockEnd={600}>
                                <Text variant="headingXl" alignment="center">
                                    { t("quantity_discount") }
                                </Text>
                            </Box>
                            <Box paddingBlockEnd={600}>
                                <Text variant="bodyLg" alignment="center">
                                    { t("quantity_discount_description") }
                                </Text>
                            </Box>
                            <Text alignment="center">
                                <Link to={`/app/quantity-discount/${quantityDiscountFunctionId}/new?headback=new`}>
                                    <Button variant="primary" tone="success" size="large">
                                        { t("create_new_offer") }
                                    </Button>
                                </Link>
                            </Text>
                        </Card>
                    </Grid.Cell>
                    <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}>
                        <Card sectioned padding={800}>
                            <Box paddingBlockEnd={600}>
                                <Text variant="headingXl" alignment="center">
                                    { t("price_discount") }
                                </Text>
                            </Box>
                            <Box paddingBlockEnd={600}>
                                <Text variant="bodyLg" alignment="center">
                                    { t("price_discount_description") }
                                </Text>
                            </Box>
                            <Text alignment="center">
                                <Link to={`/app/price-discount/${priceDiscountFunctionId}/new?headback=new`}>
                                    <Button variant="primary" tone="success" size="large">
                                        { t("create_new_offer") }
                                    </Button>
                                </Link>
                            </Text>
                        </Card>
                    </Grid.Cell>
                </Grid>
            </Page>
        </BlockStack>
    );
}
