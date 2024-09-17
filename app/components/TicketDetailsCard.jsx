import { InlineStack, InlineGrid, Select, BlockStack, Text, TextField, Button, Badge, Box, Spinner } from '@shopify/polaris';
import { SendIcon } from "@shopify/polaris-icons";
import { useSubmit, useActionData } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import  {io} from "socket.io-client";
export default function TicketDetailsCard({ticketDetails}) {
    const actionData = useActionData();
    const submit = useSubmit();
    const { t } = useTranslation();

    const [formLoader, setFormLoader] = useState(false);
    const [statusLoader, setStatusLoader] = useState(false);
    const [publishLoader, setPublishLoader] = useState(false);
    const [deleteLoader, setDeleteLoader] = useState(false);
    const [message, setMessage] = useState();
    const [messageError, setMessageError] = useState();

    const [selectedStatus, setSelectedStatus] = useState("SOLVED");

    const handleMessageChange = (newValue) => {
        if(!newValue || newValue == "") {
            setMessageError(t('field_required', { field: t('message')}));
        }
        else {
            setMessageError("");
        }
        setMessage(newValue);
    };

    const handleStatusChange = (newValue) => {
        setSelectedStatus(newValue);
    };

    const formatDate = (date) => {
        date = new Date(date);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // getMonth() returns month from 0-11
        const day = String(date.getDate()).padStart(2, '0');
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';

        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        hours = String(hours).padStart(2, '0');

        return `${hours}:${minutes}:${seconds} ${ampm} ${day}-${month}-${year}`;
    }

    const updateStatus = () => {
        if(selectedStatus != "SOLVED" && selectedStatus != "CANCELED") {
            shopify.toast.show(t('ticket_status_warning'), { isError: true });
        }
        else {
            if(!statusLoader) {
                setStatusLoader(true);
            }
            submit({
                target: "status-update", ticketId: ticketDetails.id, status: selectedStatus,
            }, { method: "POST" });
        }
    }

    //socket.io related section start
    const [socket, setSocket] = useState();

     useEffect(() => {
        const socket = io("wss://socket.efoli.com/socket.io", {

           reconnectionDelayMax: 10000
        });
        setSocket(socket);
        // Cleanup function
        return () => {
            socket.disconnect();
        };
    }, []);
 
   //socket.io related section ends
    const createReply = () => {
        if(!message || message == "") {
            setMessageError(t('field_required', { field: t('message')}));
        }
        else {
            if(!formLoader) {
                setFormLoader(true);
            }
            socket?.emit("createReplyInMerchant", {id: ticketDetails.id, slug: ticketDetails.slug, subject: ticketDetails.subject})
            submit({
                target: "create-reply", ticketId: ticketDetails.id, message: message
            }, { method: "POST" });
        }
    }

    useEffect(() => {
        if(actionData && actionData.target == "create-reply" && actionData.message == "Success" && actionData.data?.newReply?.id) {
            if(formLoader) {
                ticketDetails.ticketReplies.push(actionData.data.newReply);
                setMessage("");
                setMessageError("");
                setFormLoader(false);
            }
        }
	}, [actionData]);

    return (
        <Box>
            <BlockStack gap={200}>
                {ticketDetails ? (
                    <BlockStack gap={400}>
                        <Text variant="bodyLg" as="p">{t('ticket_no')}: {ticketDetails.slug}</Text>
                        <Text variant="headingLg" as="h5">{t('subject')}: {ticketDetails.subject}</Text>
                        <Box borderColor="border" borderWidth="050" paddingBlock={300} paddingInline={200}>
                            <InlineStack align="space-between" blockAlign="center" gap={400}>
                                <InlineStack align="space-between" gap={300}>
                                    <InlineStack wrap={false} gap={100}>
                                        <Text variant="bodyLg" as="p">{t('status')}:</Text>
                                        <Badge tone={ticketDetails.status == "SOLVED" ? "success" : ticketDetails.status == "CANCELED" ? "critical" : "attention"}>
                                            <Text variant="headingMd" as="h6">{ticketDetails.status == "PENDING" ? "OPEN" : ticketDetails.status}</Text>
                                        </Badge>
                                    </InlineStack>
                                    {(ticketDetails.status == "PENDING" || ticketDetails.status == "OPEN") && (
                                        <InlineStack wrap={false} gap={100}>
                                            <Select
                                                label={t('update_to')}
                                                labelInline
                                                options={[
                                                    { label: "SOLVED", value: "SOLVED" },
                                                    { label: "CANCELED", value: "CANCELED" }
                                                ]}
                                                onChange={handleStatusChange}
                                                value={selectedStatus}
                                            />
                                            <Button
                                                variant="primary"
                                                size="large"
                                                onClick={() => updateStatus()}
                                                loading={statusLoader}
                                            >{t('update')}</Button>
                                        </InlineStack>
                                    )}
                                </InlineStack>
                                <Text variant="bodyLg" as="p">{t('started_on')}: {formatDate(ticketDetails.createdAt)}</Text>
                            </InlineStack>
                        </Box>
                        <BlockStack gap={400}>
                            {ticketDetails.ticketReplies.map((reply, index) => (
                                <InlineStack align={reply.replyFrom == "MERCHANT" ? "end" : "start"} key={index}>
                                    <Box
                                        padding={400}
                                        borderColor="border"
                                        borderWidth="025"
                                        borderRadius="200"
                                        maxWidth="80%"
                                        background={reply.replyFrom == "MERCHANT" ? "bg-surface-info" : "bg-surface-brand"}
                                    >
                                        <BlockStack>
                                            {reply.replyFrom == "MERCHANT" ? (
                                                <Text variant="headingSm" as="h6">{t('you')}</Text>
                                            ) : (
                                                <BlockStack>
                                                    <Text variant="headingSm" as="h6">{reply.supportAgent.name}</Text>
                                                    <Text variant="bodyXs" as="p" tone="subdued">{t('support_team')}</Text>
                                                </BlockStack>
                                            )}
                                            <Box paddingBlock={200} />
                                            <Text as="p">{reply.message}</Text>
                                            <Box paddingBlock={200} />
                                            <InlineStack align="end">
                                                <Text variant="bodyXs" as="p" tone="subdued">{formatDate(reply.createdAt)}</Text>
                                            </InlineStack>
                                        </BlockStack>
                                    </Box>
                                </InlineStack>
                            ))}
                        </BlockStack>
                        {(ticketDetails.status == "PENDING" || ticketDetails.status == "OPEN") && (
                            <BlockStack gap={400}>
                                <Box paddingBlock={200} />
                                <BlockStack gap={100}>
                                    <Text as="h1" variant="headingSm">{t('message')}</Text>
                                    <TextField
                                        placeholder={t('write_detail_message_here')}
                                        value={message}
                                        onChange={handleMessageChange}
                                        multiline={1}
                                        maxLength={1200}
                                        showCharacterCount
                                        autoComplete="off"
                                    />
                                    {messageError && (
                                        <Text as="p" tone="critical">{messageError}</Text>
                                    )}
                                </BlockStack>
                                <InlineStack align="center">
                                    <Button
                                        accessibilityLabel={t('create_reply')}
                                        size="large"
                                        variant="primary"
                                        icon={SendIcon}
                                        loading={formLoader}
                                        onClick={() => createReply()}
                                    >{t('create_reply')}</Button>
                                </InlineStack>
                            </BlockStack>
                        )}
                        <Box paddingBlock={200} />
                    </BlockStack>
                ) : (
                    <BlockStack>
                        <Box minHeight="25vh" />
                        <InlineStack align="center">
                            <Spinner accessibilityLabel="Spinner example" size="large" />
                        </InlineStack>
                        <Box minHeight="25vh" />
                    </BlockStack>
                )}
            </BlockStack>
        </Box>
    );
}
