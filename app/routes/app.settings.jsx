import { useEffect, useState } from "react";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import { Bleed, BlockStack, Box, Button, Card, Grid, Page, Text, SkeletonDisplayText, Divider, ChoiceList, TextField, InlineStack, Checkbox, RadioButton } from "@shopify/polaris";
import prisma from "../db.server";
import validator from "../libs/validator";
import { authenticate } from "../shopify.server";
import { useTranslation } from "react-i18next";

export const loader = async ({ request }) => {
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
    return {
        target: "get-shop-info",
        message: "Response data",
        data: shop,
    };
};

export const action = async ({ request }) => {
    const formdata = await request.formData();
    const target = formdata.get("target");
    const shopId = parseInt(formdata.get("shopId"));
    const productPage = formdata.get("productPage");

    try {
        if(target == "upsert-settings") {
            // First get the current shop
            const upsertSettings = await prisma.settings.upsert({
                where: {
                    shopId: shopId
                },
                update: {
                    productPage: productPage,
                },
                create: {
                    shopId: shopId,
                    productPage: productPage,
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
};

export default function Settings() {
    const { t } = useTranslation();
    const submit = useSubmit();
    const actionData = useActionData() || {};
    const loaderData = useLoaderData() || {};

    const [pageLoader, setPageLoader] = useState(true);
    const [formLoader, setFormLoader] = useState(false);
    const [unsavedForm, setUnsavedForm] = useState(false);

    const [shopId, setShopId] = useState();

    const [formState, setFormState] = useState({
        layout: "table_view",
        quantity_column_header: "Buy",
        quantity_column_text: "[QTY] or more",
        discount_column_header: "Get",
        discount_column_text: "[DISCOUNT] off!",
        list_text: "Buy [QTY] or more and save [DISCOUNT]",
        show_discount_value: "show_as_set",
        css_style: "",
    });
    const [initialFormState, setInitialFormState] = useState({
        layout: "table_view",
        quantity_column_header: "Buy",
        quantity_column_text: "[QTY] or more",
        discount_column_header: "Get",
        discount_column_text: "[DISCOUNT] off!",
        list_text: "Buy [QTY] or more and save [DISCOUNT]",
        show_discount_value: "show_as_set",
        css_style: "",
    });
    const [formError, setFormError] = useState({
        quantity_column_header: "",
        quantity_column_text: "",
        discount_column_header: "",
        discount_column_text: "",
        list_text: "",
    });


    // Customer target state
    const discountValueShowingOptions = [
        { id: "show_as_set", label: t("show_as_set_in_discount")},
        { id: "show_as_amount", label: t("show_as_amount")},
        { id: "show_as_percentage", label: t("show_as_percentage")},
    ];

    const demoDiscountData = [
        {qty: 2, as_set: "5%", amount: "$7", percent: "5%"},
        {qty: 4, as_set: "$16", amount: "$16", percent: "10%"},
        {qty: 8, as_set: "$35", amount: "$35", percent: "15%"},
    ];

    // Update layout state
    const handleProductPageLayoutChange = (newValue) => {
        setFormState({ ...formState, layout: newValue[0] });
    };

    // Update quantity column header
    const handleProductPageQuantityColumnHeaderChange = (newValue) => {
        setFormState({ ...formState, quantity_column_header: newValue });
    };

    // Update quantity column text
    const handleProductPageQuantityColumnTextChange = (newValue) => {
        setFormState({ ...formState, quantity_column_text: newValue });
    };

    // Update discount column header
    const handleProductPageDiscountColumnHeaderChange = (newValue) => {
        setFormState({ ...formState, discount_column_header: newValue });
    };

    // Update discount column text
    const handleProductPageDiscountColumnTextChange = (newValue) => {
        setFormState({ ...formState, discount_column_text: newValue });
    };

    // Update list text
    const handleProductPageListTextChange = (newValue) => {
        setFormState({ ...formState, list_text: newValue });
    };

    // Update discount value option
    const handleDiscountValueShowingOptionChange = (isSet, newValue) => {
        setFormState({ ...formState, show_discount_value: newValue });
    };

    // Update css
    const handleProductPageCssStyleChange = (newValue) => {
        setFormState({ ...formState, css_style: newValue });
    };

    const renderChildrenTable = (isSelected) => {
        return (
            isSelected && (
                <Grid>
                    <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                        <Grid>
                            <Grid.Cell columnSpan={{ xs: 6, md: 3, lg: 6 }}>
                                <BlockStack gap={100}>
                                    <BlockStack gap={100}>
                                        <TextField
                                            label={ t ("quantity_column_header") }
                                            type="text"
                                            placeholder={ t ("enter_quantity_column_header") }
                                            value={formState.quantity_column_header}
                                            onChange={handleProductPageQuantityColumnHeaderChange}
                                        />
                                        {formError.quantity_column_header && (
                                            <Text as="p" tone="critical">{formError.quantity_column_header}</Text>
                                        )}
                                    </BlockStack>
                                    <BlockStack gap={100}>
                                        <TextField
                                            label={ t ("quantity_column_text") }
                                            type="text"
                                            placeholder={ t ("enter_quantity_column_text") }
                                            value={formState.quantity_column_text}
                                            onChange={handleProductPageQuantityColumnTextChange}
                                        />
                                        {formError.quantity_column_text && (
                                            <Text as="p" tone="critical">{formError.quantity_column_text}</Text>
                                        )}
                                    </BlockStack>
                                </BlockStack>
                            </Grid.Cell>
                            <Grid.Cell columnSpan={{ xs: 6, md: 3, lg: 6 }}>
                                <BlockStack gap={100}>
                                    <BlockStack gap={100}>
                                        <TextField
                                            label={ t ("discount_column_header") }
                                            type="text"
                                            placeholder={ t ("enter_discount_column_header") }
                                            value={formState.discount_column_header}
                                            onChange={handleProductPageDiscountColumnHeaderChange}
                                        />
                                        {formError.discount_column_header && (
                                            <Text as="p" tone="critical">{formError.discount_column_header}</Text>
                                        )}
                                    </BlockStack>
                                    <BlockStack gap={100}>
                                        <TextField
                                            label={ t ("discount_column_text") }
                                            type="text"
                                            placeholder={ t ("enter_discount_column_text") }
                                            value={formState.discount_column_text}
                                            onChange={handleProductPageDiscountColumnTextChange}
                                        />
                                        {formError.discount_column_text && (
                                            <Text as="p" tone="critical">{formError.discount_column_text}</Text>
                                        )}
                                    </BlockStack>
                                </BlockStack>
                            </Grid.Cell>
                        </Grid>
                    </Grid.Cell>
                </Grid>
            )
        );
    };

    const renderChildrenList = (isSelected) => {
        return (
            isSelected && (
                <BlockStack gap={100}>
                    <Grid>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 10 }}>
                            <TextField
                                label={ t ("list_view_text") }
                                type="text"
                                placeholder={ t ("enter_list_view_text") }
                                value={formState.list_text}
                                onChange={handleProductPageListTextChange}
                            />
                        </Grid.Cell>
                    </Grid>
                    {formError.list_text && (
                        <Text as="p" tone="critical">{formError.list_text}</Text>
                    )}
                </BlockStack>
            )
        );
    };

    useEffect(() => {
        if(loaderData?.data) {
            if(loaderData.target == "get-shop-info" && loaderData.data) {
                setShopId(loaderData.data.id);
                if(loaderData.data.setting) {
                    const productPageSettings = JSON.parse(loaderData.data.setting.productPage);
                    const formData = {...productPageSettings};
                    setFormState(formData);
                    setInitialFormState(formData);
                }
            }
            if(pageLoader) {
                setPageLoader(false);
            }
        }
    }, []);

    const submitForm = () => {
        setFormLoader(true);
        const validate = validator(formState, {
            quantity_column_header: "required|string|minLength:3|maxLength:50",
            quantity_column_text: "required|string|minLength:5|maxLength:50",
            discount_column_header: "required|string|minLength:3|maxLength:50",
            discount_column_text: "required|string|minLength:10|maxLength:50",
            list_text: "required|string|minLength:10|maxLength:200",
        });

        // First reset all validation
        setFormError({
            quantity_column_header: "",
            quantity_column_text: "",
            discount_column_header: "",
            discount_column_text: "",
            list_text: "",
        });
        // If error found show error
        if(validate.error) {
            /**
             * * We just can not show messages as it is. We have to trnslate them before showing
             * TODO: Loop through the error messages object retirned from validator
             * TODO: The object "key" is the field name
             * TODO: And the "value" is an object containing needed information for translation
             * TODO: The "value" object has two properties
             * TODO:    1. "i18n_key", the key-string to get actual translated string
             * TODO:    2. "i18n_properties", is an object and it's the required dynamic values for the translated string
             * TODO: "i18n_properties" can have three properties at a time
             * TODO:    1. "field", will always be present
             * TODO:    2. "parameter" and "field2" are occasional
             * TODO: After translating all messages set it to the erro message state
             */
            const errorMessages = {};
            for (const [key, value] of Object.entries(validate.messages)) {
                errorMessages[key] = t(value.i18n_key, {
                    field: t(value.i18n_properties.field),
                    ...(value.i18n_properties.parameter && {parameter: t(value.i18n_properties.parameter)}),
                    ...(value.i18n_properties.field2 && {field2: t(value.i18n_properties.field2)}),
                });
            }
            setFormError({ ...errorMessages });
            setFormLoader(false);

            let firstPropertyValue
            // Exit after accessing the first value
            for (const key in errorMessages) {
                firstPropertyValue = errorMessages[key];
                break;
            }
            shopify.toast.show(firstPropertyValue, { isError: true });
        }
        else {
            const productPage = {
                layout: formState.layout,
                quantity_column_header: formState.quantity_column_header,
                quantity_column_text: formState.quantity_column_text,
                discount_column_header: formState.discount_column_header,
                discount_column_text: formState.discount_column_text,
                list_text: formState.list_text,
                show_discount_value: formState.show_discount_value,
                css_style: formState.css_style,
            };
            submit({
                target: "upsert-settings",
                shopId: shopId,
                productPage: JSON.stringify(productPage),
            }, { method: "POST" });
        }
    };

    const discardForm = () => {
        setFormError({
            quantity_column_header: "",
            quantity_column_text: "",
            discount_column_header: "",
            discount_column_text: "",
            list_text: "",
        });
        setFormState(JSON.parse(JSON.stringify(initialFormState)));
        setUnsavedForm(false);
    }

    useEffect(() => {
        if(initialFormState.layout) {
            if(JSON.stringify(formState) != JSON.stringify(initialFormState)) {
                setUnsavedForm(true);
            }
            else {
                setUnsavedForm(false);
            }
        }
    }, [formState]);

    useEffect(() => {
        if(unsavedForm) {
            document.getElementById("dr-save-bar").show();
        }
        else {
            document.getElementById("dr-save-bar").hide();
        }
    }, [unsavedForm]);

    useEffect(() => {
        if(actionData) {
            if(actionData.target == "error") {
                if(formLoader) {
                    setFormLoader(false);
                }
                shopify.toast.show(t(actionData.message), { isError: true });
            }
            else if (actionData.target == "upsert-settings" && actionData.message == "Success") {
                if(formLoader) {
                    setInitialFormState({ ...formState });
                    setUnsavedForm(false);
                    setFormLoader(false);
                }
                shopify.toast.show(t("settings_saved_successfully"));
            }
        }
    }, [actionData]);

    return (
        <BlockStack>
            <ui-save-bar id="dr-save-bar">
                <button onClick={() => discardForm()} disabled={formLoader}></button>
                <button variant="primary" onClick={() => submitForm()} disabled={formLoader}></button>
            </ui-save-bar>
            <form onSubmit={(e) => { e.preventDefault(); submitForm() }} onReset={discardForm}>
                <Bleed>
                    <Page fullWidth>
                        {pageLoader ? (
                            <BlockStack gap={400}>
                                <Card>
                                    <BlockStack gap={200}>
                                        <Text variant="headingSm">{ t("choose_discount_display_option") }</Text>
                                        <SkeletonDisplayText maxWidth='100%' size="extraLarge" />
                                        <SkeletonDisplayText maxWidth='100%' size="extraLarge" />
                                        <SkeletonDisplayText maxWidth='100%' size="extraLarge" />
                                    </BlockStack>
                                </Card>
                                <Card>
                                    <BlockStack gap={200}>
                                        <Text variant="headingSm">{ t("how_to_show_discount_value") }</Text>
                                        <SkeletonDisplayText maxWidth='100%' size="extraLarge" />
                                    </BlockStack>
                                </Card>
                                <Card>
                                    <BlockStack gap={200}>
                                        <Text variant="headingSm">{ t("custom_css_style_for_discount_information") }</Text>
                                        <SkeletonDisplayText maxWidth='100%' size="extraLarge" />
                                        <SkeletonDisplayText maxWidth='100%' size="extraLarge" />
                                        <SkeletonDisplayText maxWidth='100%' size="extraLarge" />
                                        <SkeletonDisplayText maxWidth='100%' size="extraLarge" />
                                        <SkeletonDisplayText maxWidth='100%' size="extraLarge" />
                                        <SkeletonDisplayText maxWidth='100%' size="extraLarge" />
                                    </BlockStack>
                                </Card>
                            </BlockStack>
                        ) : (
                            <BlockStack gap={400}>
                                <Grid>
                                    <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                                        <Card>
                                            <BlockStack gap={200}>
                                                <Text variant="headingSm">{ t("choose_discount_display_option") }</Text>
                                                <Divider />
                                                <Grid>
                                                    <Grid.Cell columnSpan={{ xs: 6, lg: 8 }}>
                                                        <BlockStack gap={300}>
                                                            <ChoiceList
                                                                choices={[
                                                                    {
                                                                        label: t("table_view"),
                                                                        value: 'table_view',
                                                                        renderChildren: renderChildrenTable,
                                                                    },
                                                                    {
                                                                        label: t("list_view"),
                                                                        value: 'list_view',
                                                                        renderChildren: renderChildrenList
                                                                    },
                                                                ]}
                                                                allowMultiple={false}
                                                                selected={formState.layout}
                                                                onChange={handleProductPageLayoutChange}
                                                            />
                                                            <Box paddingBlock={200} />
                                                            <Text>*{ t ("do_not_change_or_remove_message") }</Text>
                                                        </BlockStack>
                                                    </Grid.Cell>
                                                    <Grid.Cell columnSpan={{ xs: 6, lg: 4 }}>
                                                        <BlockStack gap={300}>
                                                            <Text variant="bodyLg">{ t("discount_display_demo") }</Text>
                                                            <style rel="stylesheet">{ formState.css_style }</style>
                                                            <div id="dr-DiscountElement">
                                                            {formState.layout == "table_view" && (
                                                                <table className="dr-discountInfoTable">
                                                                    <thead>
                                                                        <tr>
                                                                            <th>{formState.quantity_column_header}</th>
                                                                            <th>{formState.discount_column_header}</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {demoDiscountData.map((discount, index) => {
                                                                            let quentityText = formState.quantity_column_text.replace("[QTY]", `<span class="dr-discountInfoTableTdQuantityValue">${discount.qty}</span>`);
                                                                            let discountText = "";
                                                                            if(formState.show_discount_value == "show_as_set") {
                                                                                discountText = formState.discount_column_text.replace("[DISCOUNT]", `<span class="dr-discountInfoTableTdDiscountValue">${discount.as_set}</span>`);
                                                                            }
                                                                            else if(formState.show_discount_value == "show_as_amount") {
                                                                                discountText = formState.discount_column_text.replace("[DISCOUNT]", `<span class="dr-discountInfoTableTdDiscountValue">${discount.amount}</span>`);
                                                                            }
                                                                            else if(formState.show_discount_value == "show_as_percentage") {
                                                                                discountText = formState.discount_column_text.replace("[DISCOUNT]", `<span class="dr-discountInfoTableTdDiscountValue">${discount.percent}</span>`);
                                                                            }
                                                                            return (
                                                                                <tr key={index}>
                                                                                    <td className="dr-discountInfoTableTdQuantity" dangerouslySetInnerHTML={{ __html: quentityText }}></td>
                                                                                    <td className="dr-discountInfoTableTdDiscount" dangerouslySetInnerHTML={{ __html: discountText }}></td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            )}
                                                            {formState.layout == "list_view" && (
                                                                <div className="dr-discountInfoList">
                                                                    {demoDiscountData.map((discount, index) => {
                                                                        let discountText = "";
                                                                        if(formState.show_discount_value == "show_as_set") {
                                                                            discountText = formState.list_text.replace("[QTY]", `<span class="dr-discountInfoListItemQuantity">${discount.qty}</span>`).replace("[DISCOUNT]", `<span class="dr-discountInfoListItemDiscount">${discount.as_set}</span>`);
                                                                        }
                                                                        else if(formState.show_discount_value == "show_as_amount") {
                                                                            discountText = formState.list_text.replace("[QTY]", `<span class="dr-discountInfoListItemQuantity">${discount.qty}</span>`).replace("[DISCOUNT]", `<span class="dr-discountInfoListItemDiscount">${discount.amount}</span>`);
                                                                        }
                                                                        else if(formState.show_discount_value == "show_as_percentage") {
                                                                            discountText = formState.list_text.replace("[QTY]", `<span class="dr-discountInfoListItemQuantity">${discount.qty}</span>`).replace("[DISCOUNT]", `<span class="dr-discountInfoListItemDiscount">${discount.percent}</span>`);
                                                                        }
                                                                        return (
                                                                            <div key={index} className="dr-discountInfoListItem" dangerouslySetInnerHTML={{ __html: discountText }}></div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                            </div>
                                                        </BlockStack>
                                                    </Grid.Cell>
                                                </Grid>
                                            </BlockStack>
                                        </Card>
                                    </Grid.Cell>
                                </Grid>
                                <Grid>
                                    <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                                        <Card>
                                            <BlockStack gap={200}>
                                                <Text variant="headingSm">{ t("how_to_show_discount_value") }</Text>
                                                <Divider />
                                                <Grid>
                                                    <Grid.Cell
                                                    columnSpan={{ xs: 6, lg: 12 }}
                                                    >
                                                    <Grid>
                                                        <Grid.Cell
                                                        columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6, xl: 6 }}
                                                        >
                                                        <InlineStack gap={600}>
                                                            {discountValueShowingOptions.map((discountValueOption, index) => (
                                                                <RadioButton
                                                                    key={index}
                                                                    name="discountValue"
                                                                    id={discountValueOption.id}
                                                                    label={discountValueOption.label}
                                                                    checked={formState.show_discount_value == discountValueOption.id}
                                                                    onChange={handleDiscountValueShowingOptionChange}
                                                                />
                                                            ))}
                                                        </InlineStack>
                                                        </Grid.Cell>
                                                    </Grid>
                                                    </Grid.Cell>
                                                </Grid>
                                            </BlockStack>
                                        </Card>
                                    </Grid.Cell>
                                </Grid>
                                <Grid>
                                    <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                                        <Card>
                                            <BlockStack gap={200}>
                                                <Text variant="headingSm">{ t("custom_css_style_for_discount_information") }</Text>
                                                <Divider />
                                                <TextField
                                                    placeholder={ t("write_css_style_for_discount_information_element") }
                                                    value={formState.css_style}
                                                    onChange={handleProductPageCssStyleChange}
                                                    multiline={4}
                                                    autoComplete="off"
                                                />
                                            </BlockStack>
                                        </Card>
                                    </Grid.Cell>
                                </Grid>
                                <BlockStack inlineAlign="end">
                                    <Button variant="primary" tone="success" size="large" loading={formLoader} submit={true}>
                                        { t("save") }
                                    </Button>
                                </BlockStack>
                                <Box padding={500}></Box>
                            </BlockStack>
                        )}
                    </Page>
                </Bleed>
            </form>
        </BlockStack>
    );
}
