import { useLoaderData } from "@remix-run/react";
import { BlockStack, Box, EmptySearchResult, Filters, Grid, Icon, InlineStack, ResourceItem, ResourceList, Text, TextField } from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SelectedRange from "../partial/SelectedRange";

const SelectionRangeModal = ({ showModal = false, parentKeyword = "", getSelectedRange, onCancel }) => {
    const { t } = useTranslation();
    const loaderData = useLoaderData();

    const discounts = loaderData?.discounts || [];
    const [items, setItems] = useState([...discounts]);
    const [pageLoader, setPageLoader] = useState(false);
    let keywordString = "";

    // Keyword state
    const [keyword, setKeyword] = useState("");

    const returnSelectedRange = (item) => {
        /**
         * * Return ranges of selected discount
         * TODO: Get the json of "discountValues", because it is saved as j JSON string
         * TODO: Now, if selected discount has ranges, return them
         * TODO: Else, return an empty array
         */
        getSelectedRange(JSON.parse(item.discountValues)?.ranges || []);
        cancelModal();
    };

    const cancelModal = () => {
        shopify.modal.hide('app-bridge-modal');
    };

    useEffect(() => {
        // Show modal
        if (showModal) {
            shopify.modal.show('app-bridge-modal');
        }
        else {
            shopify.modal.hide('app-bridge-modal');
        }
        // Check if any initial keyword is present
        if (parentKeyword) {
            keywordString = parentKeyword;
            setKeyword(keywordString);
            const filteredData = discounts.filter(item => item.title.toLowerCase().includes(parentKeyword));
            setItems(filteredData);
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
            // Wait 300ms for the user to stop typing input
            setTimeout(() => {
                const filteredData = discounts.filter(item => item.title.toLowerCase().includes(keywordString));
                setItems(filteredData);
                if(pageLoader) {
                    setPageLoader(false);
                }
            }, 300);
        });
    }, []);

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
                                placeholder={t("search_by_title")}
                                autoComplete="off"
                                prefix={<Icon source={SearchIcon} tone="base" />}
                                autoFocus={true}
                            />
                        </Grid.Cell>
                    </Grid>
                    <BlockStack>
                        {(items && items.length > 0) ? (
                            items.map((item, index) => (
                                <SelectedRange key={index} item={item} onRangeSelect={returnSelectedRange} />
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
                </BlockStack>
            </Box>
            <ui-title-bar title={ t("select_target", { target: t("ranges") }) }></ui-title-bar>
        </ui-modal>
    );
}

export default SelectionRangeModal;