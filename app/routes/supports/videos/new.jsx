import { BlockStack, Button, Banner, Card, Page, Select, Text, TextField, Grid, InlineStack } from '@shopify/polaris';
import { useEffect, useState } from 'react';
import { redirect, useActionData, useSubmit } from '@remix-run/react';
import prisma from '../../../db.server';
import { authenticator } from "../../../services/auth.server";
import { createActivityLog, getUserAccess } from '../../../libs/helpers';

export const loader = async ({ request }) => {
    const currentAgent = await getUserAccess(request, authenticator, prisma);

    // If current agent do not have access to create operation, redirect him to list page
    if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("ART_CRT")) {
        return redirect("/supports/videos");
    }
    // Else proceed to regular operations
    return {}
};

export const action = async ({ request }) => {
    const formdata = await request.formData();
    const target = formdata.get('target') || "";
    const data = formdata.get('data') || "";
    // Store video basic  info to the DB
    if (target == "create-video") {
        const currentAgent = await getUserAccess(request, authenticator, prisma);

        // If current agent do not have access to create operation, redirect him to list page
        if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("ART_CRT")) {
            return {
                target: "critical",
                message: "You do not have permission to perform this operation",
                data: [],
            }
        }
        // Else proceed to regular operations

        const video = JSON.parse(data);
        const serial = video.serial ? parseInt(video.serial) : "";
        const title = video.title || "";
        const video_id = video.video_id || "";
        const status = video.status || "";

        /**
         * * Insert a new Video with the appropriate serial number
         * TODO: Initialize the new serial number to 1 by default
         * TODO: If a specific serial number is provided:
         *        - Shift existing Videos down by one position to make room for the new Video
         *        - Update the serial numbers of Videos that are greater than or equal to the provided serial
         *        - Set the new serial number to the provided value
         * TODO: If no specific serial number is provided:
         *        - Find the current maximum serial number among existing Videos
         *        - Set the new serial number to maxSerial + 1, or 1 if no Videos exist
         * TODO: Create the new Video with the determined serial number and provided title, video_id, and status
         */
        try {
            let newSerial = 1;
            if (serial != "") {
                await prisma.youtubeVideos.updateMany({
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
                const maxSerial = await prisma.youtubeVideos.aggregate({
                    _max: {
                        serial: true,
                    },
                });
                newSerial = (maxSerial._max.serial ?? 0) + 1; // If there are no records, start with serial 1
            }

            await prisma.youtubeVideos.create({
                data: {
                    serial: parseInt(newSerial),
                    title: title,
                    video_id: video_id,
                    status: status,
                }
            });

            return {
                target: "success",
                message: "Video has been created Successfully",
                data: [],
            }
        } catch (error) {
            createActivityLog({type: "error", shop: "support", subject: "Video create", body: error});
            return {
                target: "critical",
                message: "Video creation failed please try again !!",
                data: [],
            }
        }
    }
}

export default function VideoCreate() {
    const actionData = useActionData() || {};
    const submit = useSubmit();

    const [formLoader, setFormLoader] = useState(false);
    const [formState, setFormState] = useState({
        serial: "",
        title: "",
        video_id: "",
        status: "ACTIVE",
    });
    const [formError, setFormError] = useState({
        serial: "",
        title: "",
        video_id: "",
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
    const handleVideoIdChange = (newValue) => {
        setFormState({ ...formState, video_id: newValue });
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
        if(!formState.video_id || formState.video_id == "") {
            errorMessages.video_id = "Video id is required";
            validated = false;
        }
        if(!formState.status || formState.status == "") {
            errorMessages.status = "Status is required";
            validated = false;
        }

        if(validated) {
            submit({ target: "create-video", data: JSON.stringify(formState) }, { method: "POST" });
            setDisplayBanner(true);
        }
        else {
            setFormError({ ...errorMessages });
            setFormLoader(false);
        }
    }
    /**
     * These options are used for Video status select
     * All values are pre-defined in database
     */
    const statusOptions = [
        { label: 'Active', value: 'ACTIVE' },
        { label: 'Inactive', value: 'INACTIVE' },
    ];

    /**
     * If form submit successfully ,then the form will be reset
     */
    useEffect(() => {
        if (actionData) {
            if (actionData.target == "success") {
                setFormState({ serial: "", title: "", video_id: "", status: "ACTIVE" });
                setFormError({ serial: "", title: "", video_id: "", status: "" })
            }
        }
    }, [actionData])

    // Hide banner display
    const handleBanner = () => {
        setDisplayBanner(false);
    }
    return (
        <Page title="Create Video">
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
                                <Text as="h1" variant="headingSm">Video id</Text>
                                <TextField type="text" placeholder="Video id" onChange={handleVideoIdChange} value={formState.video_id} />
                                {formError.video_id && (
                                    <Text as="p" tone="critical">{formError.video_id}</Text>
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
