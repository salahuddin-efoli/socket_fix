import { BlockStack, Box, Button, Checkbox, Divider, Grid, InlineStack, Text, Thumbnail } from "@shopify/polaris";
import { XIcon } from "@shopify/polaris-icons";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const SelectedItem = ({ target, item, preSelectedItems = [], removable = false, onItemSelect, onItemRemove }) => {
    const { t } = useTranslation();
    const [checked, setChecked] = useState(false);

    const myElementRef = useRef(null);

    const removeItem = () => {
        onItemRemove(item.id);
    }

    // Event handler function
    const handleClick = (event) => {
        // Access the current property of the ref to get the DOM node
        const element = myElementRef.current;
        if (element) {
            // Find the checkbox input element
            const checkboxElement = element.querySelector('label > span.Polaris-Choice__Control > span > span.Polaris-Checkbox__Icon.Polaris-Checkbox--animated > svg > path');

            // If the checkbox is checked then show check mark, else hide check mark
            if (event.target.checked) {
                checkboxElement.setAttribute("class", "Polaris-Checkbox--checked");
                setChecked(true);
                onItemSelect(true, item);
            }
            else {
                checkboxElement.setAttribute("class", "");
                setChecked(false);
                onItemSelect(false, item);
            }
        }
    };

    useEffect(() => {
        // Access the current property of the ref to get the DOM node
        const element = myElementRef.current;

        if (element) {
            // Find the checkbox input element
            const inputElement = element.querySelector('label > span.Polaris-Choice__Control > span > input');
            // Attach event listener when component mounts
            inputElement.addEventListener('input', handleClick);

            // Check if current item is already selected
            // If yes, then trigger the input event programmatically
            const currentItemSelected = preSelectedItems.some(obj => obj.id === item.id);
            if (currentItemSelected) {
                const event = new Event('input');
                inputElement.checked = true;
                inputElement.dispatchEvent(event);
            }
        }

        // Cleanup function to remove event listener when component unmounts
        return () => {
            if (element) {
                const inputElement = element.querySelector('label > span.Polaris-Choice__Control > span > input');
                inputElement.removeEventListener('input', handleClick);
            }
        };
    }, []); // Empty dependency array to run effect only once after initial render

    return (
        <BlockStack gap={200}>
            <Grid>
                <Grid.Cell columnSpan={{ xs: 6, lg: 10 }}>
                    <Divider />
                    <Box padding={200} width="100%">
                        <InlineStack gap={200} wrap={false} blockAlign="center">
                            {(!removable || removable == false) && (
                                <div ref={myElementRef} className="inputCheckboxContainer">
                                    <Checkbox className="inputCheckbox" checked={checked} />
                                </div>
                            )}
                            <Box width="100%">
                                <InlineStack blockAlign="center" align="space-between">
                                    {target == "customer" ? (
                                        <InlineStack gap={200} wrap={false}>
                                            <Thumbnail size="small" source={item.image?.url || ""} />
                                            <BlockStack>
                                                <Text variant="bodyMd" fontWeight="semibold">{item.displayName}</Text>
                                                <Text>{item.email}</Text>
                                            </BlockStack>
                                        </InlineStack>
                                    ) : target == "segment" ? (
                                        <Text variant="bodyLg" fontWeight="semibold">{item.name}</Text>
                                    ) : target == "productVariants" ? (
                                        <BlockStack>
                                            <Text variant="bodyLg" fontWeight="semibold">{item.title}</Text>
                                            <InlineStack gap={200} wrap={false} blockAlign="center" align="space-between">
                                                <Text variant="bodyMd">{ t("item_price", { price: item.price} ) }</Text>
                                                <Text variant="bodyMd">|</Text>
                                                <Text variant="bodyMd">{ t("quantity_left", { quantity: item.inventoryQuantity} ) }</Text>
                                            </InlineStack>
                                        </BlockStack>
                                    ) : (<Box />)}
                                    {removable && (
                                        <BlockStack align="end">
                                            <Button
                                                icon={XIcon}
                                                onClick={removeItem}
                                            />
                                        </BlockStack>
                                    )}
                                </InlineStack>
                            </Box>
                        </InlineStack>
                    </Box>
                </Grid.Cell>
            </Grid>
        </BlockStack>
    );
};

export default SelectedItem;