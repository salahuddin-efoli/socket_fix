import { useFetcher } from "@remix-run/react";
import { BlockStack, Box, EmptySearchResult, Grid, Icon, InlineStack, Spinner, TextField } from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";
import { useEffect, useState } from "react";
import SelectedItemMin from "../partial/SelectedItemMin";
import { useTranslation } from "react-i18next";

const SelectionModalMin = ({ showModal = false, target = "", parentKeyword = "", preSelectedItems = [], getSelectedData, onCancel }) => {
    const { t } = useTranslation();
    const fetcher = useFetcher();
    const actionData = fetcher.data || {};
    let items = [];
    let keywordString = "";
    let placeholder = "";

    if (target == "productType") {
        placeholder = t("search_by_product_type");
    } else if (target == "productVendor") {
        placeholder = t("search_by_product_vendor");
    } else if (target == "productTags") {
        placeholder = t("search_by_product_tag");
    }

    // Loader state
    const [pageLoader, setPageLoader] = useState(false);
    // Keyword state
    const [keyword, setKeyword] = useState('');
    // Selected items state
    const [selectedItems, setSelectedItems] = useState([...preSelectedItems]);
    let newSelectedItems = [...preSelectedItems];

    const getProductTypes = async () => {
        // Prepare query for GraphQL
        const graphqlQuery = `#graphql
        query productType($query: String) {
            products(first: 100, query:$query) {
                edges {
                    node {
                        id
                        productType
                    }
                }
            }
        }`;
        const queryParams = {
            variables: {
                query: keywordString ? `product_type:*${keywordString}*` : '',
            },
        };

        fetcher.submit({
            target: "productType",
            graphqlQuery: graphqlQuery,
            queryParams: JSON.stringify(queryParams),
        }, { method: "POST" });
    }

    const getProductVendors = async () => {
        // Prepare query for GraphQL
        const graphqlQuery = `#graphql
        query productType($query: String) {
            products(first: 100, query:$query) {
                edges {
                    node {
                        id
                        vendor
                    }
                }
            }
        }`;
        const queryParams = {
            variables: {
                query: keywordString ? `vendor:*${keywordString}*` : '',
            },
        };

        fetcher.submit({
            target: "productVendor",
            graphqlQuery: graphqlQuery,
            queryParams: JSON.stringify(queryParams),
        }, { method: "POST" });
    }

    const getProductTags = async () => {
        // Prepare query for GraphQL
        const graphqlQuery = `#graphql
        query productTags($query: String) {
            products(first: 100, query:$query) {
                edges {
                    node {
                        id
                        tags
                    }
                }
            }
        }`;
        const queryParams = {
            variables: {
                query: keywordString ? `tag:*${keywordString}*` : '',
            },
        };

        fetcher.submit({
            target: "productTags",
            graphqlQuery: graphqlQuery,
            queryParams: JSON.stringify(queryParams),
        }, { method: "POST" });
    }

    const handleSelectionChange = (add, item) => {
        if (add) {
            const itemExists = newSelectedItems.some(obj => obj === item);
            if (!itemExists) {
                newSelectedItems.push(item);
            }
        }
        else {
            const index = newSelectedItems.findIndex(obj => obj === item);
            if (index !== -1) {
                newSelectedItems.splice(index, 1);
            }
        }
        setSelectedItems([...newSelectedItems]);
    }

    const returnSelectedData = () => {
        getSelectedData(selectedItems);
        cancelModal();
    };

    const cancelModal = () => {
        shopify.modal.hide('app-bridge-modal');
    };

    if (actionData && (actionData.target == "productType")) {
        const itemList = [];
        actionData.data.forEach(element => {
            if (!itemList.includes(element.node.productType)) {
                itemList.push(element.node.productType);
            }
        });
        items = [...itemList];
    } else if (actionData && (actionData.target == "productVendor")) {
        const itemList = [];
        actionData.data.forEach(element => {
            if (!itemList.includes(element.node.vendor)) {
                itemList.push(element.node.vendor);
            }
        });
        items = [...itemList];
    } else if(actionData.target == "productTags") {
        // Use reduce to iterate over the array and accumulate all tags into a single array
        const allTags = actionData.data.reduce((acc, item) => {
            // Concatenate the current item's tags to the accumulator
            return acc.concat(item.node.tags);
        }, []);
        // Create a Set from the concatenated tags array to get unique tags
        const uniqueTags = Array.from(new Set(allTags));
        // Filter unique tags to check if they contain the keyword (case-insensitive)
        const tagsWithKeyword = uniqueTags.filter(tag => tag.toLowerCase().includes(keyword.toLowerCase()));
        items = [...tagsWithKeyword];
    }

    useEffect(() => {
        // Show modal
        if (showModal) {
            shopify.modal.show('app-bridge-modal');
        }
        else {
            shopify.modal.hide('app-bridge-modal');
        }
        // Set the item list to empty
        items = [];
        // Check if any initial keyword is present
        if (parentKeyword) {
            keywordString = parentKeyword;
            setKeyword(keywordString);
        }
        // Depending on target call appropriate function
        if (target == "productType") {
            getProductTypes();
        } else if (target == "productVendor") {
            getProductVendors();
        } else if (target == "productTags") {
            getProductTags();
        }
    }, []);

    // Detect if the modal hide action triggered
    useEffect(() => {
        document.getElementById('app-bridge-modal').addEventListener('hide', () => {
            onCancel();
        });
    }, []);

    // Detect if the input keyword has changed
    useEffect(() => {
        document.getElementById("inputKeyword").addEventListener('input', (event) => {
            // First set the page loader true
            setPageLoader(true);
            keywordString = event.target.value || "";
            // Update the keyword state
            setKeyword(keywordString);
            items = [];
            // Wait 300ms for the user to stop typing input
            setTimeout(() => {
                // Depending on target call appropriate function
                if (target == "productType") {
                    getProductTypes();
                } else if (target == "productVendor") {
                    getProductVendors();
                } else if (target == "productTags") {
                    getProductTags();
                }
            }, 300);
        });
    }, []);

    // Stop the loader then data returns
    useEffect(() => {
        if (actionData && (actionData.target == "productType" || actionData.target == "productVendor" || actionData.target == "productTags")) {
            if(pageLoader) {
                setPageLoader(false);
            }
        }
    }, [actionData]);


    return (
        <ui-modal id="app-bridge-modal">
            <Box padding={400} width="100%">
                <BlockStack gap={300} inlineAlign="stretch">
                    <Grid>
                        <Grid.Cell columnSpan={{ xs: 6 }}>
                            <TextField
                                id="inputKeyword"
                                value={keyword}
                                type="text"
                                placeholder={placeholder}
                                autoComplete="off"
                                prefix={<Icon source={SearchIcon} tone="base" />}
                                autoFocus={true}
                            />
                        </Grid.Cell>
                    </Grid>
                    {pageLoader ? (
                        <InlineStack align="center" blockAlign="stretch">
                            <Box paddingBlock={1600}>
                                <Spinner size="large" />
                            </Box>
                        </InlineStack>
                    ) : (
                        <BlockStack>
                            {(items && items.length > 0) ? (
                                items.map((item, index) => (
                                    <SelectedItemMin key={index} target={target} item={item} preSelectedItems={newSelectedItems} onItemSelect={handleSelectionChange} />
                                ))
                            ) : (
                                <Box padding={400} width="100%">
                                    <EmptySearchResult
                                        title={ t("no_results_found") }
                                        description={ t("try_changing_filters_or_search_term") }
                                        withIllustration
                                    />
                                </Box>
                            )}
                        </BlockStack>
                    )}
                </BlockStack>
            </Box>
            <ui-title-bar title={ t("select_target", { target: target.replace("product", "").toLocaleLowerCase() }) }>
                <button onClick={(e) => { e.preventDefault(); cancelModal() }}>{ t("cancel") }</button>
                <button variant="primary" onClick={(e) => { e.preventDefault(); returnSelectedData() }}>{ t("select") }</button>
            </ui-title-bar>
        </ui-modal>
    );
}

export default SelectionModalMin;