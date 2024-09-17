import { useLoaderData } from "@remix-run/react";
import { BlockStack, Box, Button, Divider, Grid, Select, Text, TextField } from "@shopify/polaris";
import { DeleteIcon, PlusIcon } from "@shopify/polaris-icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 ** Component to show quantity ranges
* RangeInfoQuantity
* @param ranges Current ranges value in formState
* @param unsavedForm Current save status of formState, to be used to discard range value
* @param returnRangeValue Function to update formState range value
*/
const RangeInfoQuantity = ({ranges, unsavedForm, returnRangeValue}) => {
    const { t } = useTranslation();
    const loaderData = useLoaderData();
    const currencyCode = loaderData?.data?.shop?.currencyCode;
    const [rangeList, setrangeList] = useState([...ranges]);

    /**
     * * Method to add a new range in quantity ranges
     * TODO: New range will be added at the end of the range list, first get the last range.
     * TODO: Range quantity is always greater than previous range quantity, so add 1 to previos range quantity to get new quantity
     * TODO: Set it's ID as current timestamp to identify it individually
     * TODO: Update the existing range list
     */
    const addRange = () => {
        const previousRange = rangeList.at(-1);
        const quantity = previousRange ? (parseInt(previousRange.quantity) + 1) : 1;
        const newRanges = [ ...rangeList, { id: new Date().getTime(), quantity: quantity, amount: 0, percent_or_currency: "%" }];
        setrangeList([ ...newRanges ]);
    };
    // Remove an existing range by it's ID
    const removeRange = (index) => {
        const newRanges = [...rangeList];
        newRanges.splice(index, 1);
        setrangeList([ ...newRanges ]);
    };
    /**
     * * Method to update range quantity
     * TODO: Range quantity is always greater than previous range quantity and smaller than next range quantity
     * TODO: First, get the pervious quantity and next quantity
     * TODO: Check whether new value is greater than previous quantity and smaller than next quantity
     * TODO: If yes, than update the quantity to new value
     * TODO: Else, ignore and do not update
     */
    const handleQuantityChange = (newValue, index) => {
        const prevQuantity = index > 0 ? rangeList[index - 1].quantity : -Infinity;
        const nextQuantity = index < rangeList.length - 1 ? rangeList[index + 1].quantity : Infinity;
        if(newValue > prevQuantity && newValue < nextQuantity) {
            updateRange(index, "quantity", parseInt(newValue));
        }
    };
    // Update range amount
    const handleAmountChange = (newValue, index) => {
        updateRange(index, "amount", parseFloat(newValue));
    };
    // Update range percent/currency
    const handlePercentOrCurrencyChange = (newValue, index) => {
        updateRange(index, "percent_or_currency", newValue);
    };
    /**
     * * Method to update quantity range values
     * TODO: First take a copy of the existing range array
     * TODO: Now, find the appropriate range by its index and assign value to the targeted dynamic property
     * TODO: Update the existing range list
     */
    const updateRange = (index, field, value) => {
        const newRanges = [...rangeList];
        newRanges[index][field] = value;
        setrangeList([ ...newRanges ]);
    };

    // Send back the range array to formState everytime the range value changes
    useEffect(() => {
        returnRangeValue([ ...rangeList ]);
    }, [rangeList]);

    useEffect(() => {
        if(!unsavedForm) {
            setrangeList([...ranges]);
        }
    }, [unsavedForm]);

    useEffect(() => {
        if(JSON.stringify(rangeList) != JSON.stringify(ranges)) {
            setrangeList([...ranges]);
        }
    }, [ranges]);

    return (
        <BlockStack gap={300}>
            <Text variant="headingSm">{ t("quantity_range") }</Text>
            <Divider />
            <Grid>
                <Grid.Cell columnSpan={{ xs: 2, lg: 5 }}>
                    <Text>{ t("quantity") }</Text>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 3, lg: 5 }}>
                    <Text>{ t("amount") }</Text>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 1, lg: 1 }}></Grid.Cell>
            </Grid>
            <BlockStack gap={400}>
                {rangeList.map((range, index) => (
                    <Grid key={index}>
                        <Grid.Cell columnSpan={{ xs: 2, lg: 5 }}>
                            <BlockStack gap={200}>
                                <TextField
                                    type="number"
                                    placeholder={ t("quantity_is_greater_or_equal_to") }
                                    value={Number(range.quantity).toString()}
                                    onChange={(value) => handleQuantityChange(value, index)}
                                    min={rangeList[index-1]?.quantity ? (parseInt(rangeList[index-1]?.quantity) + 1) : 1}
                                    max={rangeList[index+1]?.quantity ? (parseInt(rangeList[index+1]?.quantity) - 1) : null}
                                    autoComplete="off"
                                />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 3, lg: 5 }}>
                            <BlockStack gap={200}>
                                <TextField
                                    type="number"
                                    placeholder={ t("enter_discounted_amount") }
                                    value={Number(range.amount).toString()}
                                    onChange={(value) => handleAmountChange(value, index)}
                                    min={0}
                                    step={0.01}
                                    autoComplete="off"
                                    connectedRight={(
                                        <Select
                                            value={range.percent_or_currency ? range.percent_or_currency : '%'}
                                            labelHidden
                                            options={["%", currencyCode]}
                                            onChange={(value) => handlePercentOrCurrencyChange(value, index)}
                                        />
                                    )}
                                />
                            </BlockStack>
                        </Grid.Cell>
                        {rangeList.length > 1 && (
                        <Grid.Cell columnSpan={{ xs: 1, lg: 1 }}>
                            <div className="flex full-height">
                                <BlockStack align="end">
                                    <Button
                                        icon={DeleteIcon}
                                        size="large"
                                        onClick={() => removeRange(index)}
                                    />
                                </BlockStack>
                            </div>
                        </Grid.Cell>
                        )}
                    </Grid>
                ))}
            </BlockStack>
            <Box>
                <Button
                    variant="primary"
                    tone="success"
                    icon={PlusIcon}
                    onClick={addRange}
                >
                    { t("add_more") }
                </Button>
            </Box>
        </BlockStack>
    );
}

export default RangeInfoQuantity;