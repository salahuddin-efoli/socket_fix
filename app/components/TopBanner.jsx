import { useLoaderData, useSearchParams } from "@remix-run/react";
import { BlockStack, Box, Banner, Link } from "@shopify/polaris";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export default function TopBanner({title, onBannerDismiss}){
    const { t } = useTranslation();

    const loaderData = useLoaderData() || {};

    const [quantityDiscountFunctionId, setQuantityDiscountFunctionId] = useState("");
    const [priceDiscountFunctionId, setPriceDiscountFunctionId] = useState("");

    useEffect(() => {
        if(loaderData?.functionIds) {
            if(loaderData.functionIds.quantityDiscountFID) {
                setQuantityDiscountFunctionId(loaderData.functionIds.quantityDiscountFID || "");
            }
            if(loaderData.functionIds.priceDiscountFID) {
                setPriceDiscountFunctionId(loaderData.functionIds.priceDiscountFID || "");
            }
            /**
             * -------------------------------------------------
             * For any new discount start assigning IDs here...
             * -------------------------------------------------
             */
        }
    }, []);
    return (
        <BlockStack>
            <Box padding="200"></Box>
            <Banner 
                    title = { t("discount_added_message", {title: title}) }
                    tone = "success"
                    onDismiss = {() => {
                        onBannerDismiss("");
                    }
                }
            >
                <Link monochrome url={`/app/price-discount/${priceDiscountFunctionId}/new`}>{ t("create_new_price_discount") }</Link>, <Link monochrome url={`/app/quantity-discount/${quantityDiscountFunctionId}/new`}>{ t("create_new_quantity_discount") }</Link>, <Link monochrome url="/app/offer-list">{ t("show_discountray_discounts") }</Link> { t("or") } <Link monochrome url="shopify://admin/discounts" target="_top">{ t("show_all_discounts") }</Link>.
            </Banner>
        </BlockStack> 
    )
}