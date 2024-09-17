import { BlockStack, Button, Banner, Card, Page, Select, Text, TextField, Grid, InlineStack } from '@shopify/polaris';
import { useEffect, useState } from 'react';
import { redirect, useActionData, useSubmit } from '@remix-run/react';
import prisma from '../../../db.server';
import { authenticator } from "../../../services/auth.server";
import { createActivityLog, getUserAccess } from '../../../libs/helpers';

export const loader = async ({ request }) => {
    const currentAgent = await getUserAccess(request, authenticator, prisma);

    // If current agent do not have access to create operation, redirect him to list page
    if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("BNNR_CRT")) {
        return redirect("/supports/banners");
    }
    // Else proceed to regular operations
    return {}
};

export const action = async ({ request }) => {
    const formdata = await request.formData();
    const target = formdata.get('target') || "";
    const data = formdata.get('data') || "";
    // Store banner basic  info to the DB
    if (target == "create-banner") {
        const currentAgent = await getUserAccess(request, authenticator, prisma);

        // If current agent do not have access to create operation, redirect him to list page
        if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("BNNR_CRT")) {
            return {
                target: "critical",
                message: "You do not have permission to perform this operation",
                data: [],
            }
        }
        // Else proceed to regular operations

        const banner = JSON.parse(data);
        const serial = banner.serial ? parseInt(banner.serial) : "";
        const title = banner.title || "";
        const description = banner.description || "";
        const tone = banner.tone || "";
        const validity = banner?.validity  ?  new Date(banner.validity).toISOString() :  "";
        const status = banner.status || "";

        /**
         * * Insert a new Banner with the appropriate serial number
         * TODO: Initialize the new serial number to 1 by default
         * TODO: If a specific serial number is provided:
         *        - Shift existing Banners down by one position to make room for the new Banner
         *        - Update the serial numbers of Banners that are greater than or equal to the provided serial
         *        - Set the new serial number to the provided value
         * TODO: If no specific serial number is provided:
         *        - Find the current maximum serial number among existing Banners
         *        - Set the new serial number to maxSerial + 1, or 1 if no Banners exist
         * TODO: Create the new Banner with the determined serial number and provided title, description, and status
         */
        try {
            let newSerial = 1;
            if (serial != "") {
                await prisma.dashboardBanners.updateMany({
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
              const maxSerial = await prisma.dashboardBanners.aggregate({
                    _max: {
                        serial: true,
                    },
                });
                newSerial = (maxSerial._max.serial ?? 0) + 1; // If there are no records, start with serial 1
            }

            await prisma.dashboardBanners.create({
                data: {
                    serial: parseInt(newSerial),
                    title: title,
                    description: description,
                    tone: tone,
                    validity: validity,
                    status: status,
                }
            });

            return {
                target: "success",
                message: "Banner has been created Successfully",
                data: [],
            }
        } catch (error) {
            createActivityLog({type: "error", shop: "support", subject: "Banner create", body: error});
            return {
                target: "critical",
                message: "Banner creation failed please try again !!",
                data: [],
            }
        }
    }
}

export default function BannerCreate() {
    const actionData = useActionData() || {};
    const submit = useSubmit();

    const [formLoader, setFormLoader] = useState(false);
    const [formState, setFormState] = useState({
        serial: "",
        title: "",
        description: "",
        tone: "SUCCESS",
        validity: "",
        status: "ACTIVE",
    });
    const [formError, setFormError] = useState({
        serial: "",
        title: "",
        description: "",
        tone: "",
        validity: "",
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
    const handleStatusChange = (newValue) => {
        setFormState({ ...formState, status: newValue });
    }
    const handleToneChange = (newValue) => {
        setFormState({ ...formState, tone: newValue });
    }
    const handleValidityChange = (newValue) => {
        setFormState({ ...formState, validity: newValue });
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
        if (!formState.tone || formState.tone == "") {
            errorMessages.tone = "Tone is required";
            validated = false;
        }
        if (!formState.validity || formState.validity == "") {
            errorMessages.validity = "Validity is required";
            validated = false;
        }
        if(!formState.status || formState.status == "") {
            errorMessages.status = "Status is required";
            validated = false;
        }

        if(validated) {
            submit({ target: "create-banner", data: JSON.stringify(formState) }, { method: "POST" });
            setDisplayBanner(true);
        }
        else {
            setFormError({ ...errorMessages });
            setFormLoader(false);
        }
    }
    /**
     * These options are used for banner status select
     * All values are pre-defined in database
     */
    const statusOptions = [
        { label: 'Active', value: 'ACTIVE' },
        { label: 'Inactive', value: 'INACTIVE' },
    ];


    /**
    * These options are used for banner tone select
    * All values are pre-defined in database
    */
    const toneOptions = [
        { label: 'Success', value: 'SUCCESS' },
        { label: 'Info', value: 'INFO' },
        { label: 'Warning', value: 'WARNING' },
        { label: 'Critical', value: 'CRITICAL' },
    ];

    /**
     * If form submit successfully ,then the form will be reset
     */
    useEffect(() => {
        if (actionData) {
            if (actionData.target == "success") {
                setFormState({ serial: "", title: "", description: "", status: "ACTIVE", validity: "" });
                setFormError({ serial: "", title: "", description: "", status: "", validity: "" })
            }
        }
    }, [actionData])

    // Hide banner display
    const handleBanner = () => {
        setDisplayBanner(false);
    }
    return (
        <Page title="Create Banner">
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
                                <Text as="h1" variant="headingSm">Tone</Text>
                                <Select options={toneOptions} onChange={handleToneChange} value={formState.tone} />
                                {formError.tone && (
                                    <Text as="p" tone="critical">{formError.tone}</Text>
                                )}
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={200}>
                                <Text as="h1" variant="headingSm">Validity</Text>
                                <TextField type="datetime-local" placeholder="Serial" onChange={handleValidityChange} value={formState.validity}/>
                                {formError.validity && (
                                    <Text as="p" tone="critical">{formError.validity}</Text>
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
        </Page>
    );
}
