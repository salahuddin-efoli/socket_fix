import { Text } from '@shopify/polaris';
import { useTranslation } from 'react-i18next';
export default function RowCount ({ rowcount }) {
    const { t } = useTranslation();
    return (
        <>
            <Text variant="headingSm" tone="subdued">{ t("quantity_range") }</Text>
            <Text variant="bodyMd" as="p">{ t("range_count", {count: rowcount}) }</Text>
        </>
    );
};