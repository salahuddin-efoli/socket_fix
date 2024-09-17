import { BlockStack, Button, Banner, Card, Page, Select, Text, TextField, Grid, InlineStack } from '@shopify/polaris';
import { useEffect, useState } from 'react';
import { redirect, useActionData, useLoaderData, useSubmit } from '@remix-run/react';
import prisma from '../../../db.server';
import { authenticator } from "../../../services/auth.server";
import { createActivityLog, getUserAccess } from '../../../libs/helpers';

export const loader = async ({ request }) => {
    const currentAgent = await getUserAccess(request, authenticator, prisma);

    // If current agent do not have access to create operation, redirect him to list page
    if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("FRQ_CRT")) {
        return redirect("/supports/feature-requests");
    }
    // Else proceed to regular operations

    const shops = await prisma.shops.findMany({
        select: {
            id: true,
            name: true,
        },
    });

    return {
        target: "shop-list",
        message: "Success",
        data: {
            shops: shops,
        }
    }
};

export const action = async ({ request }) => {
    const formdata = await request.formData();
    const target = formdata.get('target') || "";
    const data = formdata.get('data') || "";
    // Store feature request basic  info to the DB
    if (target == "create-feature-request") {
        const currentAgent = await getUserAccess(request, authenticator, prisma);

        // If current agent do not have access to create operation, redirect him to list page
        if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("FRQ_CRT")) {
            return {
                target: "critical",
                message: "You do not have permission to perform this operation",
                data: [],
            }
        }
        // Else proceed to regular operations

        const featureRequest = JSON.parse(data);
        const serial = featureRequest.serial ? parseInt(featureRequest.serial) : "";
        const title = featureRequest.title || "";
        const description = featureRequest.description || "";
        const postedBy = featureRequest.postedBy || "";
        const shopId = featureRequest.shopId || "";
        const status = featureRequest.status || "";

        /**
         * * Insert a new Feature request with the appropriate serial number
         * TODO: Initialize the new serial number to 1 by default
         * TODO: If a specific serial number is provided:
         *        - Shift existing Feature requests down by one position to make room for the new Feature request
         *        - Update the serial numbers of Feature requests that are greater than or equal to the provided serial
         *        - Set the new serial number to the provided value
         * TODO: If no specific serial number is provided:
         *        - Find the current maximum serial number among existing Feature requests
         *        - Set the new serial number to maxSerial + 1, or 1 if no Feature requests exist
         * TODO: Create the new Feature request with the determined serial number and provided title, description, and status
         */
        try {
            let newSerial = 1;
            if (serial != "") {
                await prisma.featureRequests.updateMany({
                    where: {
                        serial: {
                            gte: serial,  // greater than or equal to the new serial
                        },
                    },
                    data: {
                        serial: {
                            increment: 1,  // increment the serial by 1
                        },
                    },
                });
                newSerial = serial;
            }
            else {
                // Find the maximum serial and set the new serial to max + 1
                const maxSerial = await prisma.featureRequests.aggregate({
                    _max: {
                        serial: true,
                    },
                });
                newSerial = (maxSerial._max.serial ?? 0) + 1; // If there are no records, start with serial 1
            }

            await prisma.featureRequests.create({
                data: {
                    serial: parseInt(newSerial),
                    title: title,
                    description: description,
                    postedBy: postedBy,
                    shopId: parseInt(shopId),
                    status: status,
                }
            });

            return {
                target: "success",
                message: "Faq has been created Successfully",
                data: [],
            }
        } catch (error) {
            createActivityLog({type: "error", shop: "support", subject: "Faq create", body: error});
            return {
                target: "critical",
                message: "Faq creation failed please try again !!",
                data: [],
            }
        }
    }
}

export default function FaqCreate() {
    const loaderData = useLoaderData() || {};
    const actionData = useActionData() || {};
    const submit = useSubmit();

    const [formLoader, setFormLoader] = useState(false);
    const shopList = loaderData?.data?.shops?.length > 0 ? loaderData?.data?.shops?.map((shop) => ({ label: shop.name, value: shop.id.toString() })) : [];
    shopList.unshift({label: "Select a shop", value: ""});

    const [formState, setFormState] = useState({
        serial: "",
        title: "",
        description: "",
        postedBy: "",
        shopId: undefined,
        status: "PENDING",
    });
    const [formError, setFormError] = useState({
        serial: "",
        title: "",
        description: "",
        postedBy: "",
        shopId: "",
        status: "",
    });
    const [displayBanner, setDisplayBanner] = useState(false);

    useEffect(() => {
        setFormLoader(false)
    }, [formLoader])

    const handleSerialChange = (newValue) => {
        setFormState({ ...formState, serial: newValue });
    }
    const handleTitleChange = (newValue) => {
        setFormState({ ...formState, title: newValue });
    }
    const handleDescriptionChange = (newValue) => {
        setFormState({ ...formState, description: newValue });
    }
    const handlePostedByChange = (newValue) => {
        setFormState({ ...formState, postedBy: newValue });
    }
    const handleShopIdChange = (newValue) => {
        setFormState({ ...formState, shopId: newValue });
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
        if(!formState.title || formState.title == "") {
            errorMessages.title = "Title is required";
            validated = false;
        }
        if(!formState.description || formState.description == "") {
            errorMessages.description = "Description is required";
            validated = false;
        }
        if(!formState.postedBy || formState.postedBy == "") {
            errorMessages.postedBy = "Posted by is required";
            validated = false;
        }
        if(!formState.shopId || formState.shopId == "") {
            errorMessages.shopId = "Shop ID is required";
            validated = false;
        }
        if(!formState.status || formState.status == "") {
            errorMessages.status = "Status is required";
            validated = false;
        }

        if(validated) {
            submit({ target: "create-feature-request", data: JSON.stringify(formState) }, { method: "POST" });
            setDisplayBanner(true);
        }
        else {
            setFormError({ ...errorMessages });
            setFormLoader(false);
        }
    }
    /**
     * These options are used for feature request status select
     * All values are pre-defined in database
     */
    const statusOptions = [
        { label: 'Pending', value: 'PENDING' },
        { label: 'Approved', value: 'APPROVED' },
        { label: 'Archived', value: 'ARCHIVED' },
    ];

    /**
     * If form submit successfully ,then the form will be reset
     */
    useEffect(() => {
        if (actionData) {
            if (actionData.target == "success") {
                setFormState({ serial: "", title: "", description: "", postedBy: "", shopId: "", status: "PENDING" });
                setFormError({ serial: "", title: "", description: "", postedBy: "", shopId: "", status: "" })
            }
        }
    }, [actionData])

    // Hide banner display
    const handleBanner = () => {
        setDisplayBanner(false);
    }
    return (
        <Page title="Create feature request">
            <BlockStack gap={300}>
                {displayBanner && actionData?.message &&
                    <Banner title={actionData?.message} tone={actionData?.target} onDismiss={handleBanner} />
                }
                <Card padding={600}>
                    <Grid>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                            <BlockStack gap={200}>
                                <Text as="h1" variant="headingSm">Title</Text>
                                <TextField type="text" placeholder="Title" onChange={handleTitleChange} value={formState.title} />
                                {formError.title && (
                                    <Text as="p" tone="critical">{formError.title}</Text>
                                )}
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={200}>
                                <Text as="h1" variant="headingSm">Serial</Text>
                                <TextField type="number" placeholder="Serial" onChange={handleSerialChange} value={formState.serial} min={1} />
                                {formError.serial && (
                                    <Text as="p" tone="critical">{formError.serial}</Text>
                                )}
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={200}>
                                <Text as="h1" variant="headingSm">Status</Text>
                                <Select options={statusOptions} onChange={handleStatusChange} value={formState.status} />
                                {formError.status && (
                                    <Text as="p" tone="critical">{formError.status}</Text>
                                )}
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={200}>
                                <Text as="h1" variant="headingSm">Posted by</Text>
                                <TextField type="email" placeholder="Posted by" onChange={handlePostedByChange} value={formState.postedBy} />
                                {formError.postedBy && (
                                    <Text as="p" tone="critical">{formError.postedBy}</Text>
                                )}
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={200}>
                                <Text as="h1" variant="headingSm">Shop</Text>
                                <Select options={shopList} onChange={(v) => handleShopIdChange(v)} value={formState.shopId} />
                                {formError.shopId && (
                                    <Text as="p" tone="critical">{formError.shopId}</Text>
                                )}
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                            <BlockStack gap={200}>
                                <Text as="h1" variant="headingSm">Description</Text>
                                <TextField
                                    type="text"
                                    placeholder="Description"
                                    multiline={4}
                                    autoComplete="off"
                                    onChange={handleDescriptionChange}
                                    value={formState.description}
                                />
                                {formError.description && (
                                    <Text as="p" tone="critical">{formError.description}</Text>
                                )}
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
        </Page>
    );
}