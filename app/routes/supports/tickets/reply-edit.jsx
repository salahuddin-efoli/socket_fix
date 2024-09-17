import { BlockStack, Box, Button, Banner, Card, Page, Select,  Text, TextField, Grid, EmptyState, SkeletonDisplayText, InlineStack } from '@shopify/polaris';
import { useEffect, useState } from 'react';
import { useActionData, useLoaderData, useNavigate, useSubmit } from '@remix-run/react';
import prisma from '../../../db.server';
import { authenticator } from '../../../services/auth.server';
import { createActivityLog } from '../../../libs/helpers';

export const loader = async ({ request, params }) => {
    const userTitle = await authenticator.isAuthenticated(request);

    // If current reply is not admin, then he does not have access to create/update reply
    // So, if current reply is not admin, redirect him to reply list
    //

    // Else carry on regular operations
    const reply = await prisma.ticketReplies.findFirst({
        where: {
            id: parseInt(params.id)
        }
    });

    return {
        target: "replyInfo",
        message: "Success",
        data: reply
    }
}

export const action = async ({ request, params }) => {
    const formdata = await request.formData();
    const target = formdata.get('target') || "";
    const data = formdata.get('data') || "";
    // Store reply basic  info to the DB
    if (target == "update-reply") {
        const reply = JSON.parse(data);
        const message = reply.message || "";
        const status = reply.status || "";
        try {
            await prisma.ticketReplies.update({
                where: { id: parseInt(params.id) },
                data: {
                    message: message,
                    status: status,
                }
            });
            return {
                target: "success",
                message: "Reply has been updated Successfully",
                data: [],
            }
        } catch (error) {
            createActivityLog({type: "error", shop: "support", subject: "Reply update", body: error});
            return {
                target: "critical",
                message: "Reply creation failed please try again !!",
                data: [],
            }
        }
    }
}

export default function ReplyEdit() {
    const loaderData = useLoaderData() || {};
    const actionData = useActionData() || {};
    const submit = useSubmit();
    const navigate = useNavigate();

    const [pageLoader, setPageLoader] = useState(true);
    const [formLoader, setFormLoader] = useState(false);
    const [replyNotFound, setReplyNotFound] = useState(false);
    const [displayBanner, setDisplayBanner] = useState(false);
    const [readyToRedirect, setReadyToRedirect] = useState(false);

    const [formState, setFormState] = useState({
        message: "",
        status: "",
    });
    const [formError, setFormError] = useState({
        message: "",
        status: "",
    });

    if(loaderData?.target == "replyInfo") {
        if(pageLoader) {
            if(loaderData?.data?.id) {
                setFormState({
                    message: loaderData.data.message,
                    status: loaderData.data.status,
                })
            }
            else {
                setReplyNotFound(true);
            }
            setPageLoader(false);
        }
    }

    const handleMessageChange = (newValue) => {
        setFormState({ ...formState, message: newValue });
    }
    const handleStatusChange = (newValue) => {
        setFormState({ ...formState, status: newValue });
    }

    // After submit data "submitForm" function send all formData to the action
    const submitForm = async () => {
        setFormLoader(true);
        let validated = true;
        const errorMessages = {};
        // Form validation
        if(!formState.message || formState.message == "") {
            errorMessages.message = "Message is required";
            validated = false;
        }
        if(validated) {
            submit({ target: "update-reply", data: JSON.stringify(formState) }, { method: "POST" });
            setDisplayBanner(true);
        }
        else {
            setFormError({ ...errorMessages });
            setFormLoader(false);
        }
    }
    /**
     * These options are used for reply status select
     * All values are pre-defined in database
     */
    const statusOptions = [
        { label: 'Publish', value: 'PUBLISHED' },
        { label: 'Unpublish', value: 'UNPUBLISHED' },
    ];

    /**
     * If form submit successfully ,then the form will be reset
     */
    if (actionData?.target) {
        if(actionData?.target == "success") {
            if(!readyToRedirect) {
                setReadyToRedirect(true);
            }
        }
        if(formLoader) {
            setFormLoader(false);
        }
    }

    // Hide banner display
    const handleBanner = () => {
        setDisplayBanner(false);
    }

    useEffect(() => {
        if(readyToRedirect) {
            navigate("/supports/tickets");
        }
    }, [readyToRedirect]);

    return (
        <Page title="Edit Ticket Reply">
            {pageLoader ? (
                <Card padding={600}>
                    <Grid>
                    <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                            <BlockStack gap="300">
                                <Text as="h1" variant="headingSm">Message</Text>
                                <SkeletonDisplayText maxWidth='100%' />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <Button variant="primary" size="large" disabled>
                                Submit
                            </Button>
                        </Grid.Cell>
                    </Grid>
                </Card>
            ): replyNotFound ? (
                <Card padding={600}>
                    <EmptyState
                        heading="Reply not found!"
                        fullWidth={true}
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                        <p>Sorry! the Reply you are looking for was not found.</p>
                    </EmptyState>
                </Card>
            ) : (
                <BlockStack gap={300}>
                    {displayBanner && actionData?.message &&
                        <Banner title={actionData?.message} tone={actionData?.target} onDismiss={handleBanner} />
                    }
                    <Card padding={600}>
                        <Grid>
                            <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                                <BlockStack gap={200}>
                                    <Text as="h1" variant="headingSm">Status</Text>
                                    <Select options={statusOptions} onChange={handleStatusChange} value={formState.status} />
                                    {formError.status && (
                                        <Text as="p" tone="critical">{formError.status}</Text>
                                    )}
                                </BlockStack>
                            </Grid.Cell>
                            <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                                <BlockStack gap={200}>
                                    <Box paddingBlock={200} />
                                    <BlockStack gap={100}>
                                        <Text as="h1" variant="headingSm">Message</Text>
                                        <TextField
                                            placeholder="Write detail message here..."
                                            value={formState.message}
                                            onChange={handleMessageChange}
                                            multiline={1}
                                            maxLength={1200}
                                            showCharacterCount
                                            autoComplete="off"
                                        />
                                        {formError.message && (
                                            <Text as="p" tone="critical">{formError.message}</Text>
                                        )}
                                    </BlockStack>
                                </BlockStack>
                            </Grid.Cell>
                            <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                                <InlineStack align="end">
                                    <Button variant="primary" size="large" onClick={() => submitForm()} loading={formLoader}>Submit</Button>
                                </InlineStack>
                            </Grid.Cell>
                        </Grid>
                    </Card>
                </BlockStack>
            )}
        </Page>
    );
}
