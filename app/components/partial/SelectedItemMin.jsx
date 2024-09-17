import { BlockStack, Box, Checkbox, Divider, Grid, InlineStack, Text } from "@shopify/polaris";
import { useEffect, useRef, useState } from "react";

const SelectedItemMin = ({ target, item, preSelectedItems = [], removable = false, onItemSelect, onItemRemove }) => {
    const [checked, setChecked] = useState(false);

    const myElementRef = useRef(null);

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
            const currentItemSelected = preSelectedItems.some(obj => obj === item);
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
                                    {(target == "productType" || target == "productVendor" || target == "productTags") ? (
                                        <Text variant="bodyLg" fontWeight="semibold">{item}</Text>
                                    ) : (<Box />)}
                                </InlineStack>
                            </Box>
                        </InlineStack>
                    </Box>
                </Grid.Cell>
            </Grid>
        </BlockStack>
    );
};

export default SelectedItemMin;