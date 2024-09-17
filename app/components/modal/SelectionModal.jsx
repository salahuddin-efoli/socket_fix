import { useFetcher } from "@remix-run/react";
import { BlockStack, Box, EmptySearchResult, Grid, Icon, InlineStack, Spinner, TextField } from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";
import { useEffect, useState } from "react";
import SelectedItem from "../partial/SelectedItem";
import { useTranslation } from "react-i18next";

const SelectionModal = ({ showModal = false, target = "", parentKeyword = "", preSelectedItems = [], getSelectedData, onCancel, productId= null }) => {
    const { t } = useTranslation();
    const fetcher = useFetcher();
    let items = [...preSelectedItems];
    let keywordString = "";
    let placeholder = "";
    if(target == "customer") {
        placeholder = t("search_by_customer_email_or_tag");
    }
    if (target == "segment") {
        placeholder = t("search_by_customer_segment");
    }
    /**
     * ----------------------------------------------------------
     * For any new target start assigning placeholders here...
     * ----------------------------------------------------------
     */

    // Loader state
    const [pageLoader, setPageLoader] = useState(true);
    // Keyword state
    const [keyword, setKeyword] = useState('');
    // Selected items state
    const [selectedItems, setSelectedItems] = useState([...preSelectedItems]);
    let newSelectedItems = [...preSelectedItems];

    const getCustomers = async () => {
        // Prepare query for GraphQL
        const graphqlQuery = `#graphql
        query customers($query: String) {
            customers(first: 20, query:$query) {
                edges {
                    node {
                        id
                        displayName
                        email
                        tags
                        image {
                            id
                            url
                        }
                    }
                }
            }
        }`;
        const queryParams = {
            variables: {
                query: keywordString ? `email:*${keywordString}* OR tag:*${keywordString}*` : '',
            },
        };

        fetcher.submit({
            target: "customer",
            graphqlQuery: graphqlQuery,
            queryParams: JSON.stringify(queryParams),
        }, { method: "POST" });
    }

    const getSegments = async () => {
        // Prepare query for GraphQL
        const graphqlQuery = `#graphql
        query segments($query: String) {
            segments(first: 20, query:$query) {
                edges {
                    node {
                        id
                        name
                    }
                }
            }
        }`;
        const queryParams = {
            variables: {
                query: keywordString ? `name:*${keywordString}*` : '',
            },
        };

        fetcher.submit({
            target: "segment",
            graphqlQuery: graphqlQuery,
            queryParams: JSON.stringify(queryParams),
        }, { method: "POST" });
    }

    const getProductVariants = async (productId) => {
        const id = productId.match(/\d+/)[0];
        // Prepare query for GraphQL
        const graphqlQuery = `#graphql
        query productVariants($query: String) {
            productVariants(first: 100, query: $query) {
                edges {
                    node {
                        id
                        title
                        inventoryQuantity
                        price
                    }
                }
            }
        }`;
        const queryParams = {
            variables: {
                query: `product_id:${id}`,
            },
        };

        fetcher.submit({
            target: "productVariants",
            graphqlQuery: graphqlQuery,
            queryParams: JSON.stringify(queryParams),
        }, { method: "POST" });
    }

    const handleSelectionChange = (add, item) => {
        if (add) {
            const itemExists = newSelectedItems.some(obj => obj.id === item.id);
            if (!itemExists) {
                newSelectedItems.push(item);
            }
        }
        else {
            const index = newSelectedItems.findIndex(obj => obj.id === item.id);
            if (index !== -1) {
                newSelectedItems.splice(index, 1);
            }
        }
        setSelectedItems([...newSelectedItems]);
    }

    const returnSelectedData = (e) => {
        getSelectedData(selectedItems);
        cancelModal(e);
    };

    const cancelModal = (e) => {
        e.preventDefault();
        shopify.modal.hide('app-bridge-modal');
    };

    const actionData = fetcher.data || {};
    if (actionData && (actionData.target == "customer" || actionData.target == "segment" || actionData.target == "productVariants")) {
        const itemList = [];
        actionData.data.edges.forEach(element => {
            itemList.push(element.node);
        });
        items = [...itemList];
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
        if (target == "customer") {
            getCustomers();
        }
        else if (target == "segment") {
            getSegments();
        }
        else if (target == "productVariants") {
            getProductVariants(productId);
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
        if (target == "customer" || target == "segment") {
            document.getElementById("inputKeyword").addEventListener('input', (event) => {
                // First set the page loader true
                setPageLoader(true);
                keywordString = event.target.value || "";
                // Update the keyword state
                setKeyword(keywordString);
                // Wait 300ms for the user to stop typing input
                setTimeout(() => {
                    // Depending on target call appropriate function
                    if (target == "customer") {
                        getCustomers();
                    }
                    else if (target == "segment") {
                        getSegments();
                    }
                    /**
                     * ----------------------------------------------------
                     * For any new target start calling methods here...
                     * ----------------------------------------------------
                     */
                }, 300);
            });
        }
    }, []);

    // Stop the loader then data returns
    useEffect(() => {
        if (actionData && (actionData.target == "customer" || actionData.target == "segment" || actionData.target == "productVariants")) {
            setPageLoader(false);
        }
    }, [actionData]);

    return (
        <ui-modal id="app-bridge-modal">
            <Box padding={400} width="100%">
                <BlockStack gap={300} inlineAlign="stretch">
                    {(target == "customer" || target == "segment") && 
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
                    }
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
                                    <SelectedItem key={index} target={target} item={item} preSelectedItems={newSelectedItems} onItemSelect={handleSelectionChange} />
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
            <ui-title-bar title={ t("select_target", { target: target == "productVariants" ? "variants" : target }) }>
                <button onClick={cancelModal}>{ t("cancel") }</button>
                <button variant="primary" onClick={returnSelectedData}>{ t("select") }</button>
            </ui-title-bar>
        </ui-modal>
    );
}

export default SelectionModal;