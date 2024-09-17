import { Bleed, BlockStack, Box, Button, Banner, Card, Divider, Page, Select, SkeletonBodyText, Text, TextField, Grid, EmptyState, SkeletonDisplayText, InlineStack } from '@shopify/polaris';
import { ListBulletedIcon } from '@shopify/polaris-icons';
import { useEffect, useState } from 'react';
import { redirect, useActionData, useLoaderData, useNavigate, useSubmit } from '@remix-run/react';
import prisma from '../../../db.server';
import { authenticator } from "../../../services/auth.server";
import { createActivityLog, getUserAccess } from '../../../libs/helpers';

export const loader = async ({ request, params }) => {
    const currentAgent = await getUserAccess(request, authenticator, prisma);

    // If current agent do not have access to edit operation, redirect him to list page
    if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("FRQ_EDT")) {
        return redirect("/supports/feature-requests");
    }
    // Else proceed to regular operations

    const shops = await prisma.shops.findMany({
        select: {
            id: true,
            name: true,
        },
    });

    const featureRequest = await prisma.featureRequests.findFirst({
        where: {
            id: parseInt(params.id),
            deletedAt: null,
        }
    });

    return {
        target: "featureRequestInfo",
        message: "Success",
        data: featureRequest,
        shops: shops,
    }
}

export const action = async ({ request, params }) => {
    const formdata = await request.formData();
    const target = formdata.get('target') || "";
    const data = formdata.get('data') || "";
    // Store feature request basic  info to the DB
    if (target == "update-feature-request") {
        const currentAgent = await getUserAccess(request, authenticator, prisma);

        // If current agent do not have access to edit operation, redirect him to list page
        if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("FRQ_EDT")) {
            return {
                target: "critical",
                message: "You do not have permission to perform this operation",
                data: [],
            }
        }
        // Else proceed to regular operations

        const featureRequest = JSON.parse(data);
        const newSerial = featureRequest.serial ? parseInt(featureRequest.serial) : "";
        const title = featureRequest.title || "";
        const description = featureRequest.description || "";
        const postedBy = featureRequest.postedBy || "";
        const shopId = featureRequest.shopId || "";
        const status = featureRequest.status || "";

        /**
         * * Update an existing Feature request's serial number and details
         * TODO: Step 1: Find the current serial of the Feature request using the provided ID
         *        - Retrieve the Feature request record and extract its current serial number
         * TODO: Step 2: Determine the new serial number for the Feature request
         *        - If a new serial number is provided:
         *          - If the new serial is greater than the current serial:
         *            - Shift the serial numbers of Feature requests between currentSerial+1 and targetSerial down by 1
         *          - If the new serial is less than the current serial:
         *            - Shift the serial numbers of Feature requests between targetSerial and currentSerial-1 up by 1
         *        - If no new serial is provided:
         *          - Keep the same serial number as the current one
         * TODO: Update the Feature request with the new serial number and the provided title, description, status, and updatedAt timestamp
         */
        try {
            const currentFeatureRequest = await prisma.featureRequests.findUnique({
                where: { id: parseInt(params.id) },
            });
            const currentSerial = currentFeatureRequest.serial;

            let targetSerial;

            if (newSerial != "") {
                targetSerial = newSerial;

                if (targetSerial > currentSerial) {
                    await prisma.featureRequests.updateMany({
                        where: {
                            serial: {
                                gt: currentSerial,
                                lte: targetSerial,
                            },
                        },
                        data: {
                            serial: {
                                decrement: 1,  // decrement the serial by 1
                            },
                        },
                    });
                }
                else if (targetSerial < currentSerial) {
                    await prisma.featureRequests.updateMany({
                        where: {
                            serial: {
                                gte: targetSerial,
                                lt: currentSerial,
                            },
                        },
                        data: {
                            serial: {
                                increment: 1,  // increment the serial by 1
                            },
                        },
                    });
                }
            }
            else {
                targetSerial = currentSerial;
            }

            await prisma.featureRequests.update({
                where: { id: parseInt(params.id) },
                data: {
                    serial: parseInt(targetSerial),
                    title: title,
                    description: description,
                    postedBy: postedBy,
                    shopId: parseInt(shopId),
                    status: status,
                    updatedAt: new Date()
                }
            });
            return {
                target: "success",
                message: "Feature request has been updated Successfully",
                data: [],
            }
        } catch (error) {
            createActivityLog({type: "error", shop: "support", subject: "Feature request update", body: error});
            return {
                target: "critical",
                message: "Feature request creation failed please try again !!",
                data: [],
            }
        }
    }
}

export default function FeatureRequestEdit() {
    const loaderData = useLoaderData() || {};
    const actionData = useActionData() || {};
    const submit = useSubmit();
    const navigate = useNavigate();

    const [pageLoader, setPageLoader] = useState(true);
    const [formLoader, setFormLoader] = useState(false);
    const shopList = loaderData?.shops?.length > 0 ? loaderData?.shops?.map((shop) => ({ label: shop.name, value: shop.id.toString() })) : [];

    const [featureRequestNotFound, setFeatureRequestNotFound] = useState(false);
    const [displayBanner, setDisplayBanner] = useState(false);
    const [readyToRedirect, setReadyToRedirect] = useState(false);

    const [formState, setFormState] = useState({
        serial: "",
        title: "",
        description: "",
        postedBy: "",
        shopId: "",
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

    if(loaderData?.target == "featureRequestInfo") {
        if(pageLoader) {
            if(loaderData?.data?.id) {
                setFormState({
                    serial: loaderData.data.serial,
                    title: loaderData.data.title,
                    description: loaderData.data.description,
                    postedBy: loaderData.data.postedBy,
                    shopId: loaderData.data.shopId,
                    status: loaderData.data.status,
                })
            }
            else {
                setFeatureRequestNotFound(true);
            }
            setPageLoader(false);
        }
    }

    const handleSerialChange = (newValue) => {
        setFormState({ ...formState, serial: newValue });
    }
    const handleTitleChange = (newValue) => {
        setFormState({ ...formState, title: newValue });
    }
    const handleDescriptionChange = (newValue) => {
        setFormState({ ...formState, description: newValue })
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
            submit({ target: "update-feature-request", data: JSON.stringify(formState) }, { method: "POST" });
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
            navigate("/supports/feature-requests");
        }
    }, [readyToRedirect]);

    return (
        <Page title="Edit feature request">
            {pageLoader ? (
                <Card padding={600}>
                    <Grid>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                            <BlockStack gap="300">
                                <Text as="h1" variant="headingSm">Title</Text>
                                <SkeletonDisplayText maxWidth='100%' />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={300}>
                                <Text as="h1" variant="headingSm">Serial</Text>
                                <SkeletonDisplayText maxWidth='100%' />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap="300">
                                <Text as="h1" variant="headingSm">Status</Text>
                                <SkeletonDisplayText maxWidth='100%' />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={300}>
                                <Text as="h1" variant="headingSm">Posted by</Text>
                                <SkeletonDisplayText maxWidth='100%' />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap="300">
                                <Text as="h1" variant="headingSm">Shop</Text>
                                <SkeletonDisplayText maxWidth='100%' />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                            <BlockStack gap="300">
                                <Text as="h1" variant="headingSm">Description</Text>
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
            ): featureRequestNotFound ? (
                <Card padding={600}>
                    <EmptyState
                        heading="Feature request not found!"
                        fullWidth={true}
                        action={{
                            content: "Create feature request",
                            url: "/supports/feature-requests/new"
                        }}
                        secondaryAction={{
                            content: "Feature request list",
                            url: "/supports/feature-requests/"
                        }}
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                        <p>Sorry! the feature request you are looking for was not found.</p>
                    </EmptyState>
                </Card>
            ) : (
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
                                    <Select options={shopList} onChange={handleShopIdChange} value={formState.shopId} />
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
            )}
        </Page>
    );
}