import { ActionList, BlockStack, Box, Button, Card, Checkbox, Divider, Icon, InlineGrid, InlineStack, Popover, Scrollable, Text, TextField, Tooltip } from "@shopify/polaris";
import { DeleteIcon, PlusIcon, QuestionCircleIcon } from "@shopify/polaris-icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 ** Component to show quantity ranges
* RangeInfoPrice
* @param product Current product of formState
* @param ranges Current ranges value in formState
* @param returnRangeValue Function to update formState range value
*/
const RangeInfoPrice = ({ranges, returnRangeValue}) => {
    const { t } = useTranslation();
    const [rangeList, setRangeList] = useState([...ranges]);
    const [samePrices, setSamePrices] = useState([]);

    /**
     * * Method to add a new range in quantity ranges
     * TODO: New range will be added at the end of the range list, first get the last range.
     * TODO: Range quantity is always greater than previous range quantity, so add 1 to previos range quantity to get new quantity
     * TODO: Set it's ID as current timestamp to identify it individually
     * TODO: Update the existing range list
     */
    const addRange = () => {
        const newRanges = [...rangeList];
        const previousRange = rangeList[0].prices.at(-1);
        const quantity = previousRange ? (parseInt(previousRange.quantity) + 1) : 1;
        for (let index = 0; index < newRanges.length; index++) {
            newRanges[index].prices.push({ id: new Date().getTime(), quantity: quantity, price: 0 });
        }
        const newSamePrices = [...samePrices];
        newSamePrices.push(false);

        setRangeList([ ...newRanges ]);
        setSamePrices([...newSamePrices]);
    };

    // Remove an existing range by it's ID
    const removeRange = (targetIndex) => {
        const newRanges = [...rangeList];
        for (let index = 0; index < newRanges.length; index++) {
            newRanges[index].prices.splice(targetIndex, 1);
        }
        const newSamePrices = [...samePrices];
        newSamePrices.splice(targetIndex, 1);

        setRangeList([ ...newRanges ]);
        setSamePrices([...newSamePrices]);
    };
    /**
     * * Method to update range quantity
     * TODO: Range quantity is always greater than previous range quantity and smaller than next range quantity
     * TODO: First, get the pervious quantity and next quantity
     * TODO: Check whether new value is greater than previous quantity and smaller than next quantity
     * TODO: If yes, than update the quantity to new value
     * TODO: Else, ignore and do not update
     */
    const handleQuantityChange = (newValue, targetIndex) => {
        const prevQuantity = targetIndex > 0 ? rangeList[0].prices[targetIndex - 1].quantity : -Infinity;
        const nextQuantity = targetIndex < rangeList[0].prices.length - 1 ? rangeList[0].prices[targetIndex + 1].quantity : Infinity;
        
        if(parseInt(newValue) > prevQuantity && parseInt(newValue) < nextQuantity) {
            const newRanges = [...rangeList];
            for (let index = 0; index < newRanges.length; index++) {
                rangeList[index].prices[targetIndex].quantity = parseInt(newValue);
            }
            setRangeList([ ...newRanges ]);
        }
    };
    const handleSamePrice = (newValue, index) => {
        const newSamePrices = [...samePrices];
        newSamePrices[index] = newValue;
        setSamePrices([...newSamePrices]);
        if(newValue) {
            const newRanges = [...rangeList];
            const firstPrice = newRanges[0].prices[index].price;
            for (let i = 0; i < newRanges.length; i++) {
                newRanges[i].prices[index].price = firstPrice;
            }
            setRangeList([ ...newRanges ]);
        }
    }
    /**
     * * Method to update quantity range values
     * TODO: First take a copy of the existing range array
     * TODO: Now, find the appropriate range by its index and assign value to the targeted dynamic property
     * TODO: Update the existing range list
     */
    // Update range price
    const handlePriceChange = (newValue, index, targetIndex) => {
        const newRanges = [...rangeList];
        if(samePrices[targetIndex]) {
            for (let i = 0; i < newRanges.length; i++) {
                newRanges[i].prices[targetIndex].price = newValue;
            }
        }
        else {
            newRanges[index].prices[targetIndex].price = parseFloat(newValue);
        }
        setRangeList([ ...newRanges ]);
    };

    // Send back the range array to formState everytime the range value changes
    useEffect(() => {
        returnRangeValue([ ...rangeList ]);
    }, [rangeList]);

    useEffect(() => {
        setSamePrices(Array.from({ length: ranges[0]?.prices.length || 0 }, () => false));
    }, []);

    useEffect(() => {
        if(JSON.stringify(rangeList) != JSON.stringify(ranges)) {
            setRangeList([...ranges]);
        }
    }, [ranges]);

    return (
        <BlockStack gap={300}>
            <InlineStack align="space-between">
                <Text variant="headingSm">{ t("quantity_range") }</Text>
                <Button
                    variant="primary"
                    tone="success"
                    icon={PlusIcon}
                    onClick={addRange}
                >
                    { t("add_more") }
                </Button>
            </InlineStack>
            <Divider />
            <Scrollable shadow>
                <BlockStack gap={200} inlineAlign="stretch">
                    <InlineGrid columns={{xs: ['oneHalf', 'oneHalf'], lg: ['oneThird', 'twoThirds']}} alignItems="center">
                        <Box>
                            <Text style={{minWidth: "250px"}}>{ t("variants") + " - " + t("unit_price") + " / " + t("quantity") }</Text>
                        </Box>
                        <Box padding={200}>
                            <InlineStack gap={200} wrap={false}>
                                {rangeList[0].prices.map((price, index) => (
                                    <Box key={`Q${index}`}>
                                        <div style={{width: "150px"}}>
                                            <BlockStack gap={100}>
                                                <TextField
                                                    type="number"
                                                    label={ t("quantity") }
                                                    placeholder={ t("quantity_is_greater_or_equal_to") }
                                                    value={Number(price.quantity).toString()}
                                                    onChange={(value) => handleQuantityChange(value, index)}
                                                    min={rangeList[0].prices[index-1]?.quantity ? (parseInt(rangeList[0].prices[index-1]?.quantity) + 1) : 1}
                                                    autoComplete="off"
                                                />
                                                <InlineStack gap={100} blockAlign="center">
                                                    <Checkbox
                                                        label={t("same_price")}
                                                        checked={samePrices[index]}
                                                        onChange={(value) => handleSamePrice(value, index)}
                                                    />
                                                    <Tooltip content={t("for_all_variants_at_this_quantity")} dismissOnMouseOut>
                                                        <Icon
                                                            source={QuestionCircleIcon}
                                                            tone="base"
                                                        />
                                                    </Tooltip>
                                                </InlineStack>
                                            </BlockStack>
                                        </div>
                                    </Box>
                                ))}
                            </InlineStack>
                        </Box>
                    </InlineGrid>
                    {rangeList.map((range, index) => (
                        <BlockStack gap={200} inlineAlign="stretch" key={index}>
                            <Divider />
                            <InlineGrid columns={{xs: ['oneHalf', 'oneHalf'], lg: ['oneThird', 'twoThirds']}} alignItems="center">
                                <Box>
                                    <Text variant="bodyLg" fontWeight="semibold" style={{minWidth: "250px"}}>{range.title}</Text>
                                    <Text variant="bodyMd">{ t("item_price", { price: range.old_price} ) }</Text>
                                </Box>
                                <Box padding={200}>
                                    <InlineStack gap={200} wrap={false}>
                                        {range.prices.map((price, j) => (
                                            <Box key={`${index}-${j}`}>
                                                <div style={{width: "150px"}}>
                                                    <TextField
                                                        type="number"
                                                        placeholder={ t("enter_unit_price") }
                                                        value={Number(price.price).toString()}
                                                        onChange={(value) => handlePriceChange(value, index, j)}
                                                        min={0}
                                                        step={0.01}
                                                        autoComplete="off"
                                                    />
                                                </div>
                                            </Box>
                                        ))}
                                    </InlineStack>
                                </Box>
                            </InlineGrid>
                        </BlockStack>
                    ))}
                    {rangeList[0].prices.length > 1 && (
                        <BlockStack inlineAlign="stretch">
                            <Divider />
                            <InlineGrid columns={{xs: ['oneHalf', 'oneHalf'], lg: ['oneThird', 'twoThirds']}} alignItems="center">
                                <Box>
                                    <Text style={{minWidth: "250px"}}></Text>
                                </Box>
                                <Box padding={200}>
                                    <InlineStack gap={200} blockAlign="center" wrap={false}>
                                        {rangeList[0].prices.map((price, index) => (
                                            <Box key={`Q${index}`} padding={0}>
                                                <div style={{width: "150px"}}>
                                                    <InlineStack align="center">
                                                        <PopoverComponent index={index} onRemove={(targetIndex) => removeRange(targetIndex)} />
                                                    </InlineStack>
                                                </div>
                                            </Box>
                                        ))}
                                    </InlineStack>
                                </Box>
                            </InlineGrid>
                        </BlockStack>
                    )}
                </BlockStack>
            </Scrollable>
        </BlockStack>
    );
}

export default RangeInfoPrice;

const PopoverComponent = ({index, onRemove}) => {
    const [popoverActive, setPopoverActive] = useState(false);
    const activator = (<Button onClick={() => togglePopoverActive()} icon={DeleteIcon} size="large" />);

    const togglePopoverActive = () => setPopoverActive((popoverActive) => !popoverActive);

    const removeItem = () => {
        onRemove(index);
        setPopoverActive(false);
    }

    return (
        <Popover active={popoverActive} activator={activator} onClose={() => togglePopoverActive()}>
            <Card>
                <BlockStack inlineAlign="center" gap={300}>
                    <Text>Remove this quantity set?</Text>
                    <InlineStack gap={200}>
                        <Button onClick={() => setPopoverActive(false)}>No</Button>
                        <Button variant="primary" tone="critical" onClick={() => removeItem()}>Yes</Button>
                    </InlineStack>
                </BlockStack>
            </Card>
        </Popover>
    );
}