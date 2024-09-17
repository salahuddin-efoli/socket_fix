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
    if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("FAQ_EDT")) {
        return redirect("/supports/faqs");
    }
    // Else proceed to regular operations

    const faq = await prisma.faqs.findFirst({
        where: {
            id: parseInt(params.id)
        }
    });

    return {
        target: "faqInfo",
        message: "Success",
        data: faq
    }
}

export const action = async ({ request, params }) => {
    const formdata = await request.formData();
    const target = formdata.get('target') || "";
    const data = formdata.get('data') || "";
    // Store faq basic  info to the DB
    if (target == "update-faq") {
        const currentAgent = await getUserAccess(request, authenticator, prisma);

        // If current agent do not have access to edit operation, redirect him to list page
        if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("FAQ_EDT")) {
            return {
                target: "critical",
                message: "You do not have permission to perform this operation",
                data: [],
            }
        }
        // Else proceed to regular operations

        const faq = JSON.parse(data);
        const newSerial = faq.serial ? parseInt(faq.serial) : "";
        const title = faq.title || "";
        const description = faq.description || "";
        const status = faq.status || "";

        /**
         * * Update an existing FAQ's serial number and details
         * TODO: Step 1: Find the current serial of the FAQ using the provided ID
         *        - Retrieve the FAQ record and extract its current serial number
         * TODO: Step 2: Determine the new serial number for the FAQ
         *        - If a new serial number is provided:
         *          - If the new serial is greater than the current serial:
         *            - Shift the serial numbers of FAQs between currentSerial+1 and targetSerial down by 1
         *          - If the new serial is less than the current serial:
         *            - Shift the serial numbers of FAQs between targetSerial and currentSerial-1 up by 1
         *        - If no new serial is provided:
         *          - Keep the same serial number as the current one
         * TODO: Update the FAQ with the new serial number and the provided title, description, status, and updatedAt timestamp
         */
        try {
            const currentFaq = await prisma.faqs.findUnique({
                where: { id: parseInt(params.id) },
            });
            const currentSerial = currentFaq.serial;

            let targetSerial;

            if (newSerial != "") {
                targetSerial = newSerial;

                if (targetSerial > currentSerial) {
                    await prisma.faqs.updateMany({
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
                    await prisma.faqs.updateMany({
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

            await prisma.faqs.update({
                where: { id: parseInt(params.id) },
                data: {
                    serial: parseInt(targetSerial),
                    title: title,
                    description: description,
                    status: status,
                    updatedAt: new Date()
                }
            });
            return {
                target: "success",
                message: "Faq has been updated Successfully",
                data: [],
            }
        } catch (error) {
            createActivityLog({type: "error", shop: "support", subject: "Faq update", body: error});
            return {
                target: "critical",
                message: "Faq creation failed please try again !!",
                data: [],
            }
        }
    }
}

export default function FaqEdit() {
    const loaderData = useLoaderData() || {};
    const actionData = useActionData() || {};
    const submit = useSubmit();
    const navigate = useNavigate();

    const [pageLoader, setPageLoader] = useState(true);
    const [formLoader, setFormLoader] = useState(false);
    const [faqNotFound, setFaqNotFound] = useState(false);
    const [displayBanner, setDisplayBanner] = useState(false);
    const [readyToRedirect, setReadyToRedirect] = useState(false);

    const [formState, setFormState] = useState({
        serial: "",
        title: "",
        description: "",
        status: "ACTIVE",
    });
    const [formError, setFormError] = useState({
        serial: "",
        title: "",
        description: "",
        status: "",
    });

    if(loaderData?.target == "faqInfo") {
        if(pageLoader) {
            if(loaderData?.data?.id) {
                setFormState({
                    serial: loaderData.data.serial,
                    title: loaderData.data.title,
                    description: loaderData.data.description,
                    status: loaderData.data.status,
                })
            }
            else {
                setFaqNotFound(true);
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
        if(!formState.status || formState.status == "") {
            errorMessages.status = "Status is required";
            validated = false;
        }

        if(validated) {
            submit({ target: "update-faq", data: JSON.stringify(formState) }, { method: "POST" });
            setDisplayBanner(true);
        }
        else {
            setFormError({ ...errorMessages });
            setFormLoader(false);
        }
    }
    /**
     * These options are used for faq status select
     * All values are pre-defined in database
     */
    const statusOptions = [
        { label: 'Active', value: 'ACTIVE' },
        { label: 'Inactive', value: 'INACTIVE' },
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
            navigate("/supports/faqs");
        }
    }, [readyToRedirect]);

    return (
        <Page title="Edit FAQ">
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
            ): faqNotFound ? (
                <Card padding={600}>
                    <EmptyState
                        heading="Faq not found!"
                        fullWidth={true}
                        action={{
                            content: "Create faq",
                            url: "/supports/faqs/new"
                        }}
                        secondaryAction={{
                            content: "Faq list",
                            url: "/supports/faqs/"
                        }}
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                        <p>Sorry! the faq you are looking for was not found.</p>
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
                                        helpText="Enter actual HTML text"
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