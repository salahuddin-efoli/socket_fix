import { BlockStack, Box, Button, Checkbox, Divider, Grid, InlineStack, Text, Thumbnail } from "@shopify/polaris";
import { XIcon } from "@shopify/polaris-icons";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const SelectedRange = ({ item, onRangeSelect }) => {
    const { t } = useTranslation();
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
                setTimeout(() => {
                    onRangeSelect(item);
                }, 300);
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
                            <div ref={myElementRef} className="inputCheckboxContainer">
                                <Checkbox className="inputCheckbox" checked={checked} />
                            </div>
                            <Box width="100%">
                                <InlineStack blockAlign="center" align="space-between">
                                    <Text variant="bodyLg" fontWeight="semibold">{item.title}</Text>
                                </InlineStack>
                            </Box>
                        </InlineStack>
                    </Box>
                </Grid.Cell>
            </Grid>
        </BlockStack>
    );
};

export default SelectedRange;