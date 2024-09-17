import { Select, BlockStack, Text, TextField, Button, Box, Grid } from '@shopify/polaris';
import { useSubmit } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";

export default function TicketCreateCard({shopInfo = null, shops = [], viewAs}) {
    const submit = useSubmit();
    const { t } = useTranslation();

    const [shopOptions, setShopOptions] = useState([]);
    const [selectedShop, setSelectedShop] = useState();
    const [formLoader, setFormLoader] = useState(false);
    const [formState, setFormState] = useState({
        shopId: shopInfo?.id || "",
        email: shopInfo?.email || "",
        subject: "",
        message: "",
    });
    const [formError, setFormError] = useState({
        shop: "",
        email: "",
        subject: "",
        message: "",
    });

    useEffect(() => {
        if(viewAs == "SUPPORT") {
            const shopsToAdd = [{
                label: "Select a shop",
                value: "",
            }];
            for (let index = 0; index < shops.length; index++) {
                const shop = shops[index];
                shopsToAdd.push({
                    label: shop.name,
                    value: shop.email,
                });
            }
            setShopOptions(shopsToAdd);
        }
    }, []);

    const handleShopChange = (newValue) => {
        setSelectedShop(newValue);
        if(!newValue || newValue == "") {
            setFormError({ ...formError, shop: viewAs == "SUPPORT" ? "Shop is required" : t('field_required', { field: t('shop')}) });
        }
        else {
            setFormError({ ...formError, shop: "" });
            const selectedShop = shops.find(shop => shop.email == newValue);
            if(selectedShop) {
                setFormState({ ...formState, shopId: selectedShop.id, email: selectedShop.email });
            }
        }
    }

    const handleEmailChange = (newValue) => {
        if(!newValue || newValue == "") {
            setFormError({ ...formError, email: viewAs == "SUPPORT" ? "Email is required" : t('field_required', { field: t('email')}) });
        }
        else {
            setFormError({ ...formError, email: "" });
        }
        setFormState({ ...formState, email: newValue });
    }
    const handleSubjectChange = (newValue) => {
        if(!newValue || newValue == "") {
            setFormError({ ...formError, subject: viewAs == "SUPPORT" ? "Subject is required" : t('field_required', { field: t('subject')}) });
        }
        else {
            setFormError({ ...formError, subject: "" });
        }
        setFormState({ ...formState, subject: newValue });
    }
    const handleMessageChange = (newValue) => {
        if(!newValue || newValue == "") {
            setFormError({ ...formError, message: viewAs == "SUPPORT" ? "Message is required" : t('field_required', { field: t('message')}) });
        }
        else {
            setFormError({ ...formError, message: "" });
        }
        setFormState({ ...formState, message: newValue });
    }

    const createTicket = () => {
        setFormLoader(true);
        let validated = true;
        const errorMessages = {};
        // Form validation
        if(!formState.email || formState.email == "") {
            errorMessages.email = viewAs == "SUPPORT" ? "Email is required" : t('field_required', { field: t('email')});
            validated = false;
        }
        if(!formState.subject || formState.subject == "") {
            errorMessages.subject = viewAs == "SUPPORT" ? "Subject is required" : t('field_required', { field: t('subject')});
            validated = false;
        }
        if(!formState.message || formState.message == "") {
            errorMessages.message = viewAs == "SUPPORT" ? "Message is required" : t('field_required', { field: t('message')});
            validated = false;
        }

        if(validated) {
            submit({
                target: "create-ticket", shopId: formState.shopId, email: formState.email, subject: formState.subject, message: formState.message
            }, { method: "POST" });
        }
        else {
            setFormError({ ...errorMessages });
            setFormLoader(false);
        }
    }

    return (
        <Box>
            <Grid>
                {viewAs == "SUPPORT" && (
                    <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                        <BlockStack gap={200}>
                            <Text as="h1" variant="headingSm">Shop</Text>
                            <Select
                                options={shopOptions}
                                onChange={handleShopChange}
                                value={selectedShop}
                            />
                            {formError.shop && (
                                <Text as="p" tone="critical">{formError.shop}</Text>
                            )}
                        </BlockStack>
                    </Grid.Cell>
                )}
                <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                    <BlockStack gap={200}>
                        <Text as="h1" variant="headingSm">{viewAs == "SUPPORT" ? "Email" : t('email')}</Text>
                        <TextField
                            name="email"
                            type="email"
                            placeholder={viewAs == "SUPPORT" ? "Email" : t('email')}
                            value={formState.email}
                            onChange={handleEmailChange}
                            maxLength={100}
                            autoComplete="off"
                        />
                        {formError.email && (
                            <Text as="p" tone="critical">{formError.email}</Text>
                        )}
                    </BlockStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                    <BlockStack gap={200}>
                        <Text as="h1" variant="headingSm">{viewAs == "SUPPORT" ? "Subject" : t('subject')}</Text>
                        <TextField
                            name="subject"
                            type="text"
                            placeholder={viewAs == "SUPPORT" ? "Ticket subject" : t('ticket_subject')}
                            value={formState.subject}
                            onChange={handleSubjectChange}
                            maxLength={100}
                            showCharacterCount
                            autoComplete="off"
                        />
                        {formError.subject && (
                            <Text as="p" tone="critical">{formError.subject}</Text>
                        )}
                    </BlockStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                    <BlockStack gap={200}>
                        <Text as="h1" variant="headingSm">{viewAs == "SUPPORT" ? "Message" : t('message')}</Text>
                        <TextField
                            name="message"
                            placeholder={viewAs == "SUPPORT" ? "Write detail message here..." : t('write_detail_message_here')}
                            value={formState.message}
                            onChange={handleMessageChange}
                            multiline={2}
                            maxLength={1200}
                            showCharacterCount
                            autoComplete="off"
                        />
                        {formError.message && (
                            <Text as="p" tone="critical">{formError.message}</Text>
                        )}
                    </BlockStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                    <Button variant="primary" size="large" onClick={createTicket} loading={formLoader}>
                        Create ticket
                    </Button>
                </Grid.Cell>
            </Grid>
        </Box>
    );
}