import { InlineStack, InlineGrid, Select, BlockStack, Text, TextField, Button, Badge, Box, Spinner, Tooltip, ButtonGroup } from '@shopify/polaris';
import { UndoIcon, SendIcon, EditIcon, CheckIcon, XIcon, DeleteIcon } from "@shopify/polaris-icons";
import { useSubmit, useActionData } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import  {io} from "socket.io-client";

export default function TicketDetailsCardSupport({ticketDetails, currentAgent = null, agentList = []}) {
    const actionData = useActionData();
    const submit = useSubmit();
    const { t } = useTranslation();

    const [formLoader, setFormLoader] = useState(false);
    const [statusLoader, setStatusLoader] = useState(false);
    const [agentLoader, setAgentLoader] = useState(false);
    const [editLoader, setEditLoader] = useState(false);
    const [reviewLoader, setReviewLoader] = useState(false);
    const [publishLoader, setPublishLoader] = useState(false);
    const [deleteLoader, setDeleteLoader] = useState(false);
    const [message, setMessage] = useState();
    const [messageError, setMessageError] = useState();

    const [selectedStatus, setSelectedStatus] = useState("SOLVED");
    const [selectedReplyId, setSelectedReplyId] = useState("");

    const [selectedAgent, setSelectedAgent] = useState("");
    const agentOptions = agentList.length > 0 ? agentList.map((agent) => ({ label: agent.name, value: agent.id.toString() })) : [];

    const handleMessageChange = (newValue) => {
        if(!newValue || newValue == "") {
            setMessageError("Message is required");
        }
        else {
            setMessageError("");
        }
        setMessage(newValue);
    };

    const handleStatusChange = (newValue) => {
        setSelectedStatus(newValue);
    };

    const handleAgentChange = (newValue) => {
        setSelectedAgent(newValue);
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
        if(selectedStatus != "OPEN" && selectedStatus != "SOLVED" && selectedStatus != "CANCELED") {
            shopify.toast.show("Status can only be changed to OPEN, SOLVED or CANCELED");
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

    const updateAgent = () => {
        if(!agentLoader) {
            setAgentLoader(true);
        }
        submit({
            target: "agent-update", ticketId: ticketDetails.id, oldAgent: ticketDetails.supportAgentId, newAgent: selectedAgent,
        }, { method: "POST" });
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
            setMessageError("Message is required");
        }
        else {
            if(!formLoader) {
                setFormLoader(true);
            }
            socket?.emit("createReplyInSupport", {id: ticketDetails.id, slug: ticketDetails.slug, subject: ticketDetails.subject})
            submit({
                target: "create-reply", ticketId: ticketDetails.id, message: message
            }, { method: "POST" });
        }
    }

    const toggleReplyEdit = async (reply) => {
        if(reply) {
            setMessage(reply.message);
            setMessageError("");
            setSelectedReplyId(reply.id);
        }
        else {
            setSelectedReplyId("");
            setMessage("");
            setMessageError("");
        }
    }

    const updateReplyMessage = async () => {
        if(!message || message == "") {
            setMessageError("Message is required");
        }
        else {
            if(!editLoader) {
                setEditLoader(true);
            }
            submit({
                target: "reply-message-update",
                replyId: selectedReplyId,
                message: message,
                status: (currentAgent.role == "ADMIN" || currentAgent.permissions.includes("TCKT_RPL_DSUB")) ? "PUBLISHED" : "UNPUBLISHED"
            }, { method: "POST" });
        }
    }

    const updateReplyStatus = async (replyId, status) => {
        if(status == "PUBLISHED" && !publishLoader) {
            setPublishLoader(true);
        }
        if(status == "REVIEW" && !reviewLoader) {
            setReviewLoader(true);
        }
        submit({
            target: "reply-status-update",
            replyId: replyId,
            status: status
        }, { method: "POST" });
    }

    const deleteReply = async (replyId) => {
        if(!deleteLoader) {
            setDeleteLoader(true);
        }
        submit({
            target: "reply-delete", replyId: replyId , ticketId: ticketDetails.id
        }, { method: "POST" });
    }

    useEffect(() => {
        if(actionData && actionData.message == "Success") {
            if(actionData.target == "create-reply" && actionData.data?.newReply?.id) {
                if(formLoader) {
                    ticketDetails.ticketReplies.push(actionData.data.newReply);
                    setMessage("");
                    setMessageError("");
                    setFormLoader(false);
                }
            }
            if(actionData.target == "reply-message-update" && actionData.data?.updatedReply?.id) {
                if(editLoader) {
                    ticketDetails.ticketReplies = ticketDetails.ticketReplies.map(reply =>
                        reply.id === actionData.data.updatedReply.id ? actionData.data.updatedReply : reply
                    );
                    setSelectedReplyId("");
                    setMessage("");
                    setMessageError("");
                    setEditLoader(false);
                }
            }
            else if (actionData.target == "reply-delete" && actionData.message == "Success" && actionData.data?.ticketDetails?.id) {
                if(deleteLoader) {
                    setDeleteLoader(false);
                }
            }
        }
	}, [actionData]);

    return (
        <Box>
            <BlockStack gap={200}>
                {ticketDetails ? (
                    <BlockStack gap={400}>
                        <Text variant="bodyLg" as="p">Ticket no: {ticketDetails.slug}</Text>
                        <Text variant="headingLg" as="h5">Subject: {ticketDetails.subject}</Text>
                        <Box borderColor="border" borderWidth="050" paddingBlock={300} paddingInline={200}>
                            <InlineStack align="space-between" blockAlign="center" gap={400}>
                                <InlineStack align="space-between" gap={300}>
                                    <InlineStack wrap={false} gap={100}>
                                        <Text variant="bodyLg" as="p">Status:</Text>
                                        <Badge tone={ticketDetails.status == "SOLVED" ? "success" : ticketDetails.status == "CANCELED" ? "critical" : "attention"}>
                                            <Text variant="headingMd" as="h6">{ticketDetails.status}</Text>
                                        </Badge>
                                    </InlineStack>
                                    {(ticketDetails.status == "PENDING" || ticketDetails.status == "OPEN") && (
                                        <InlineStack wrap={false} gap={100}>
                                            <Select
                                                label="Update to"
                                                labelInline
                                                options={[
                                                    {label: "OPEN", value: "OPEN"},
                                                    { label: "SOLVED", value: "SOLVED" },
                                                    { label: "CANCELED", value: "CANCELED" }
                                                ]}
                                                onChange={handleStatusChange}
                                                value={selectedStatus}
                                            />
                                            {currentAgent?.permissions?.includes("TCKT_EDT_STTS") &&
                                                <Button
                                                    variant="primary"
                                                    size="large"
                                                    onClick={() => updateStatus()}
                                                    loading={statusLoader}
                                                >Update</Button>
                                            }
                                        </InlineStack>
                                    )}
                                    <InlineStack wrap={false} gap={100}>
                                        <Select
                                            label="Assign to"
                                            labelInline
                                            options={agentOptions}
                                            onChange={handleAgentChange}
                                            value={selectedAgent}
                                        />
                                        {currentAgent?.permissions?.includes("TCKT_FWRD") &&
                                            <Button
                                                variant="primary"
                                                size="large"
                                                onClick={() => updateAgent()}
                                                loading={agentLoader}
                                            >Assign</Button>
                                        }
                                    </InlineStack>
                                </InlineStack>
                                <Text variant="bodyLg" as="p">Started on: {formatDate(ticketDetails.createdAt)}</Text>
                            </InlineStack>
                        </Box>
                        <BlockStack gap={400}>
                            {ticketDetails.ticketReplies.map((reply, index) => (
                                <InlineStack align={reply.replyFrom == "SUPPORT" ? "end" : "start"} key={index}>
                                    <Box
                                        padding={400}
                                        borderColor="border"
                                        borderWidth="025"
                                        borderRadius="200"
                                        maxWidth="80%"
                                        background={reply.replyFrom == "SUPPORT" ? "bg-surface-info" : "bg-surface-brand"}
                                    >
                                        <BlockStack>
                                            <InlineStack gap={800} align="space-between">
                                                {currentAgent.id == reply.supportAgentId ? (
                                                    <Text variant="headingSm" as="h6">You</Text>
                                                ) : (
                                                    reply.supportAgentId == null ? (
                                                        <BlockStack>
                                                            <Text variant="headingSm" as="h6">{ticketDetails.shop.name}</Text>
                                                            <Text variant="bodyXs" as="p" tone="subdued">Shopify Merchant</Text>
                                                        </BlockStack>
                                                    ) : (
                                                        <BlockStack>
                                                            <Text variant="headingSm" as="h6">{reply.supportAgent.name}</Text>
                                                            <Text variant="bodyXs" as="p" tone="subdued">{reply.supportAgent.role}</Text>
                                                        </BlockStack>
                                                    )
                                                )}
                                                <Badge tone={reply.status == "PUBLISHED" ? "success" : reply.status == "UNPUBLISHED" ? "attention" : "warning"}>
                                                    {reply.status}
                                                </Badge>
                                            </InlineStack>
                                            <Box paddingBlock={200} />
                                            {selectedReplyId && reply.id == selectedReplyId ? (
                                                <BlockStack gap={100}>
                                                    <TextField
                                                        placeholder="Write detail message here..."
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
                                            ) : (
                                                <Text as="p">{reply.message}</Text>
                                            )}
                                            <Box paddingBlock={200} />
                                            <InlineStack align="end">
                                                <Text variant="bodyXs" as="p" tone="subdued">{formatDate(reply.createdAt)}</Text>
                                            </InlineStack>
                                            {reply.replyFrom == "SUPPORT" && ticketDetails.status == "OPEN"  && (
                                                <Box paddingBlockStart={400}>
                                                    <InlineStack gap={400}>
                                                        {(currentAgent.role == "ADMIN" || currentAgent.permissions.includes("TCKT_RPL_DLT")) &&
                                                            <Tooltip content="Delete" dismissOnMouseOut>
                                                                <Button icon={DeleteIcon} size="large" tone="critical" onClick={() => deleteReply(reply.id)} loading={deleteLoader}>Delete</Button>
                                                            </Tooltip>
                                                        }
                                                        {(((reply.status == "REVIEW" && reply.supportAgentId == currentAgent.id) || currentAgent.role == "ADMIN" || currentAgent.permissions.includes("TCKT_RPL_DSUB")) && (
                                                            selectedReplyId == reply.id ? (
                                                                <ButtonGroup>
                                                                    <Tooltip content="Cancel" dismissOnMouseOut>
                                                                        <Button icon={XIcon} size="large" onClick={() => toggleReplyEdit()}>Cancel</Button>
                                                                    </Tooltip>
                                                                    <Tooltip content="Submit" dismissOnMouseOut>
                                                                        <Button icon={CheckIcon} size="large" variant="primary" onClick={() => updateReplyMessage()} loading={editLoader}>Submit</Button>
                                                                    </Tooltip>
                                                                </ButtonGroup>
                                                            ) : (
                                                                <Tooltip content="Edit" dismissOnMouseOut>
                                                                    <Button icon={EditIcon} size="large" onClick={() => toggleReplyEdit(reply)}>Edit</Button>
                                                                </Tooltip>
                                                            )
                                                        ))}
                                                        {(reply.status == "UNPUBLISHED" && (currentAgent.role == "ADMIN" || currentAgent.permissions.includes("TCKT_RPL_DSUB")) && selectedReplyId == "" && (
                                                            <>
                                                                <Tooltip content="Send for review" dismissOnMouseOut>
                                                                    <Button icon={UndoIcon} size="large" onClick={() => updateReplyStatus(reply.id, "REVIEW")} loading={reviewLoader}>Send for review</Button>
                                                                </Tooltip>
                                                                <Tooltip content="Publish" dismissOnMouseOut>
                                                                    <Button icon={SendIcon} size="large" variant="primary" onClick={() => updateReplyStatus(reply.id, "PUBLISHED")} loading={publishLoader}>Publish</Button>
                                                                </Tooltip>
                                                            </>
                                                        ))}
                                                    </InlineStack>
                                                </Box>
                                            )}
                                        </BlockStack>
                                    </Box>
                                </InlineStack>
                            ))}
                        </BlockStack>
                        {(ticketDetails.status == "OPEN" || (currentAgent.role == "ADMIN" || currentAgent.role == "AGENT") || selectedReplyId != "") && (
                            <BlockStack gap={400}>
                                <Box paddingBlock={200} />
                                <BlockStack gap={100}>
                                    <Text as="h1" variant="headingSm">Message</Text>
                                    <TextField
                                        placeholder="Write detail message here..."
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
                                        accessibilityLabel="Create reply"
                                        size="large"
                                        variant="primary"
                                        icon={SendIcon}
                                        loading={formLoader}
                                        onClick={() => createReply()}
                                    >Create reply</Button>
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
