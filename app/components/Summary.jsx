import { BlockStack, Box, Button, Card, Divider, InlineGrid, InlineStack, Text } from "@shopify/polaris";
import { XIcon } from '@shopify/polaris-icons';
import { useTranslation } from "react-i18next";


export default function Summary({ title, applyType, typeLength, rangeType=null, rowcount, status, startDate, startTime, endTimeChecked, endDate, endTime, customerType, customerOptionsLenght, handleSummaryDisplay=null }){
    const { t } = useTranslation();
    return (
        handleSummaryDisplay ? (
            <Card>
                <BlockStack gap={400}>
                    <InlineStack wrap={false} align="space-between">
                        <Box>
                            <Text variant="headingSm" as="h6">{ t("summary") }</Text>
                        </Box>
                        <Box>
                            <Button icon={XIcon} variant="plain" tone="critical" size="large" onClick={() => handleSummaryDisplay(false)}>  </Button>
                        </Box>
                    </InlineStack>
                    
                    <Divider />
                    <Box>
                        <Text variant="headingSm" tone="subdued">{ t("title") }</Text>
                        <Text variant="bodyMd" as="p" breakWord>{title || '-'}</Text>
                    </Box>
                    <InlineGrid columns={2}>
                        <Box>
                            <Text variant="headingSm" tone="subdued">{applyType != 'title' ?  t("applies_to") : t("product")} </Text>
                            {applyType == "product" ? (
                                <Text variant="bodyMd" as="p">{ t("specific_product_count", {number: typeLength}) }</Text>
                            ) : applyType == "collection" ? (
                                <Text variant="bodyMd" as="p">{ t("specific_collection_count", {number: typeLength}) }</Text>
                            ) : applyType == "tag" ? (
                                <Text variant="bodyMd" as="p">{ t("specific_tag_count", {number: typeLength}) }</Text>
                            ) : applyType == "vendor" ? (
                                <Text variant="bodyMd" as="p">{ t("specific_vendor_count", {number: typeLength}) }</Text>
                            ) : applyType == "type" ? (
                                <Text variant="bodyMd" as="p">{ t("specific_type_count", {number: typeLength}) }</Text>
                            ) : applyType == "title" ? (
                                <Text  as="p" alignment="justify" fontWeight="regular">{typeLength ? typeLength : '-'}</Text>
                            ) : (
                                <Text variant="bodyMd" as="p">{typeLength}</Text>
                            )}
                        </Box>
                        {rangeType ? 
                            <Box>
                                <Text variant="headingSm" tone="subdued">{ t("type") }</Text>
                                <Text variant="bodyMd" as="p">{rangeType.charAt(0).toUpperCase() + rangeType.slice(1) || '-'}</Text>
                            </Box>
                        : '' }
                    </InlineGrid>
                    <InlineGrid columns={2}>
                        <Box>
                            <Text variant="headingSm" tone="subdued">{ t("quantity_range") }</Text>
                            <Text variant="bodyMd" as="p">{ t("range_count", {count: rowcount}) }</Text>
                        </Box>
                        <Box>
                            <Text variant="headingSm" tone="subdued">{ t("customer_eligibility") }</Text>
                            {customerType == "segment" ? (
                                <Text variant="bodyMd" as="p">{ t("customer_segment_count", {number: customerOptionsLenght}) }</Text>
                            ) : customerType == "customer" ? (
                                <Text variant="bodyMd" as="p">{ t("specific_customer_count", {number: customerOptionsLenght}) }</Text>
                            ) : (
                                <Text variant="bodyMd" as="p">{customerOptionsLenght}</Text>
                            )}
                        </Box>
                    </InlineGrid>
                    <Box>
                        <Text variant="headingSm" tone="subdued">{ t("status") }</Text>
                        <Text variant="bodyMd" as="p" breakWord>{status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() || '-'}</Text>
                    </Box>
                    {status == "SCHEDULED" && (<>
                    <InlineGrid columns={2}>
                        <Box>
                            <Text variant="headingSm" tone="subdued">{ t("start_date") }</Text>
                            <Text variant="bodyMd" as="p">{startDate || '-'}</Text>
                        </Box>
                        <Box>
                            <Text variant="headingSm" tone="subdued">{ t("start_time") }</Text>
                            <Text variant="bodyMd" as="p">{startTime || '-'}</Text>
                        </Box>
                    </InlineGrid>
                    {endTimeChecked ? (
                        <InlineGrid columns={2}>
                            <Box>
                                <Text variant="headingSm" tone="subdued">{ t("end_date") }</Text>
                                <Text variant="bodyMd" as="p">{endDate || '-'}</Text>
                            </Box>
                            <Box>
                                <Text variant="headingSm" tone="subdued">{ t("end_time") }</Text>
                                <Text variant="bodyMd" as="p">{endTime || '-'}</Text>
                            </Box>
                        </InlineGrid>
                    ) : (
                        <Text variant="bodyMd" as="p">{ t("no_end_date") }</Text>
                    )}
                    </>)}
                </BlockStack>
            </Card>
        ) : (
            <Card>
                <BlockStack gap={400}>
                    <Text variant="headingSm" as="h6">{ t("summary") }</Text>
                    <Divider />
                    <Box>
                        <Text variant="headingSm" tone="subdued">{ t("title") }</Text>
                        <Text variant="bodyMd" as="p" breakWord>{title || '-'}</Text>
                    </Box>
                    <Box>
                        <Text variant="headingSm" tone="subdued">{applyType != 'title' ?  t("applies_to") : t("product")} </Text>
                        {applyType == "product" ? (
                            <Text variant="bodyMd" as="p">{ t("specific_product_count", {number: typeLength}) }</Text>
                        ) : applyType == "collection" ? (
                            <Text variant="bodyMd" as="p">{ t("specific_collection_count", {number: typeLength}) }</Text>
                        ) : applyType == "tag" ? (
                            <Text variant="bodyMd" as="p">{ t("specific_tag_count", {number: typeLength}) }</Text>
                        ) : applyType == "vendor" ? (
                            <Text variant="bodyMd" as="p">{ t("specific_vendor_count", {number: typeLength}) }</Text>
                        ) : applyType == "type" ? (
                            <Text variant="bodyMd" as="p">{ t("specific_type_count", {number: typeLength}) }</Text>
                        ) : applyType == "title" ? (
                            <Text variant="bodyMd" as="p">{typeLength ? typeLength : '-'}</Text>
                        ) : (
                            <Text variant="bodyMd" as="p">{typeLength}</Text>
                        )}
                    </Box>
                    {rangeType ?
                        <Box>
                            <Text variant="headingSm" tone="subdued">{ t("type") }</Text>
                            <Text variant="bodyMd" as="p">{rangeType.charAt(0).toUpperCase() + rangeType.slice(1) || '-'}</Text>
                        </Box>
                    : ''}
                    <Box>
                        <Text variant="headingSm" tone="subdued">{ t("quantity_range") }</Text>
                        <Text variant="bodyMd" as="p">{`${rowcount} range(s)`}</Text>
                    </Box>
                    <Box>
                        <Text variant="headingSm" tone="subdued">{ t("status") }</Text>
                        <Text variant="bodyMd" as="p" breakWord>{status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() || '-'}</Text>
                    </Box>
                    {status == "SCHEDULED" && (<>
                    <InlineGrid columns={2}>
                        <Box>
                            <Text variant="headingSm" tone="subdued">{ t("start_date") }</Text>
                            <Text variant="bodyMd" as="p">{startDate || '-'}</Text>
                        </Box>
                        <Box>
                            <Text variant="headingSm" tone="subdued">{ t("start_time") }</Text>
                            <Text variant="bodyMd" as="p">{startTime || '-'}</Text>
                        </Box>
                    </InlineGrid>
                    {endTimeChecked ? (
                        <InlineGrid columns={2}>
                            <Box>
                                <Text variant="headingSm" tone="subdued">{ t("end_date") }</Text>
                                <Text variant="bodyMd" as="p">{endDate || '-'}</Text>
                            </Box>
                            <Box>
                                <Text variant="headingSm" tone="subdued">{ t("end_time") }</Text>
                                <Text variant="bodyMd" as="p">{endTime || '-'}</Text>
                            </Box>
                        </InlineGrid>
                    ) : (
                        <Text variant="bodyMd" as="p">{ t("no_end_date") }</Text>
                    )}
                    </>)}
                    <Box>
                        <Text variant="headingSm" tone="subdued">{ t("customer_eligibility") }</Text>
                        {customerType == "segment" ? (
                            <Text variant="bodyMd" as="p">{ t("customer_segment_count", {number: customerOptionsLenght}) }</Text>
                        ) : customerType == "customer" ? (
                            <Text variant="bodyMd" as="p">{ t("specific_customer_count", {number: customerOptionsLenght}) }</Text>
                        ) : (
                            <Text variant="bodyMd" as="p">{customerOptionsLenght}</Text>
                        )}
                    </Box>
                </BlockStack>
            </Card>
        )
    );
}