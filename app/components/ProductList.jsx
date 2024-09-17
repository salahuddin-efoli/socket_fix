import { BlockStack, Box, Button, Divider, Grid, InlineStack, Text, Thumbnail } from "@shopify/polaris";
import { ImageIcon, XIcon } from "@shopify/polaris-icons";
import { useCallback, useState } from "react";
import SelectionModal from "./modal/SelectionModal";
import { useTranslation } from "react-i18next";

export default function ProductList({ products, collections, removeProduct, applyType, updateProductsVariants }) {
    const { t } = useTranslation();
    const [modalActive, setmodalActive] = useState(false);
    const [selectionVarintIds, setSelectionVarintIds] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState("");

    const handleVariant = (id) => {
        const seletedProducts = products.find(product => product.id === id);

        setSelectedProductId(id);
        setSelectionVarintIds(seletedProducts.variants);
        setmodalActive(!modalActive);
    }

    const handleChange = useCallback(() => setmodalActive(!modalActive), [modalActive]);

    if (products?.length > 0 && applyType === 'product') {
        return (
            <BlockStack gap={0}>
                {products.map((product, index) => (
                    <BlockStack gap={100} key={index}>
                        <Box paddingBlock={200}>
                            <Divider />
                        </Box>
                        <Grid>
                            <Grid.Cell columnSpan={{ xs: 6, lg: 10 }}>
                                <InlineStack wrap={false} blockAlign="center" align="space-between">
                                    <InlineStack gap={200}>
                                        <Thumbnail source={product.images} />
                                        <BlockStack>
                                            <Text variant="bodyLg" fontWeight="semibold">{product.title}</Text>
                                            <Text>{ t("product_variants_selected", {selected: product.variants.length, total: product.options.length}) }</Text>
                                        </BlockStack>
                                    </InlineStack>
                                    <BlockStack align="end">
                                        <InlineStack wrap={false} blockAlign="center" align="space-between">
                                            <InlineStack gap={600}>
                                                <Button
                                                    size="large"
                                                    variant="plain"
                                                    onClick={() => handleVariant(product.id)}
                                                >Edit</Button>
                                                <Button
                                                    tone="critical"
                                                    icon={XIcon}
                                                    size="large"
                                                    value=""
                                                    onClick={() => removeProduct(product.id)}
                                                />
                                            </InlineStack>

                                        </InlineStack>

                                    </BlockStack>
                                </InlineStack>
                            </Grid.Cell>
                        </Grid>
                        <VariantModal modalActive={modalActive} handleChange={handleChange} selectionVarintIds={selectionVarintIds} updateProductsVariants={updateProductsVariants} selectedProductId={selectedProductId}></VariantModal>
                    </BlockStack>
                ))}
            </BlockStack>
        );
    } else if (collections?.length > 0 && applyType === 'collection') {
        return (
            <BlockStack gap={0}>
                {collections.map((collection, index) => (
                    <BlockStack gap={100} key={index}>
                        <Box paddingBlock={200}>
                            <Divider />
                        </Box>
                        <Grid>
                            <Grid.Cell columnSpan={{ xs: 6, lg: 10 }}>
                                <InlineStack wrap={false} blockAlign="center" align="space-between">
                                    <InlineStack gap={200}>
                                        <Thumbnail source={ImageIcon} size="small" />
                                        <BlockStack>
                                            <Text variant="bodyLg" fontWeight="semibold">{collection.title}</Text>
                                        </BlockStack>
                                    </InlineStack>
                                    <BlockStack align="end">
                                        <InlineStack wrap={false} blockAlign="center" align="space-between">
                                            <InlineStack gap={600}>
                                                <Button
                                                    tone="critical"
                                                    icon={XIcon}
                                                    size="large"
                                                    value=""
                                                    onClick={() => removeProduct(collection.id)}
                                                />
                                            </InlineStack>

                                        </InlineStack>

                                    </BlockStack>
                                </InlineStack>
                            </Grid.Cell>
                        </Grid>
                        <Box />
                    </BlockStack>
                ))}
            </BlockStack>
        );
    } else {
        return (
            <>
                <Box></Box>
            </>
        );
    }
}


function VariantModal({ modalActive, handleChange, selectionVarintIds, updateProductsVariants, selectedProductId }) {
    const handleProductVariant = (newItem) => {
        updateProductsVariants(selectedProductId, newItem)
        handleChange();
    }

    return (
        <>
            {(modalActive) ? (
                <SelectionModal
                    showModal={modalActive}
                    target={"productVariants"}
                    parentKeyword={""}
                    preSelectedItems={selectionVarintIds}
                    getSelectedData={handleProductVariant}
                    onCancel={handleChange}
                    productId={selectedProductId}
                />
            ) : (<Box />)}
        
        </>
        
    );

}