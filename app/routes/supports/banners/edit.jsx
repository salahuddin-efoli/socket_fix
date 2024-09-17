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
    if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("BNNR_EDT")) {
        return redirect("/supports/banners");
    }
    // Else proceed to regular operations

    const banner = await prisma.dashboardBanners.findFirst({
        where: {
            id: parseInt(params.id)
        }
    });

    return {
        target: "BannerInfo",
        message: "Success",
        data: banner
    }
}

export const action = async ({ request, params }) => {
    const formdata = await request.formData();
    const target = formdata.get('target') || "";
    const data = formdata.get('data') || "";
    // Store banner basic  info to the DB
    if (target == "update-banner") {
        const currentAgent = await getUserAccess(request, authenticator, prisma);

        // If current agent do not have access to edit operation, redirect him to list page
        if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("BNNR_EDT")) {
            return {
                target: "critical",
                message: "You do not have permission to perform this operation",
                data: [],
            }
        }
        // Else proceed to regular operations

        const banner = JSON.parse(data);
        const newSerial = banner.serial ? parseInt(banner.serial) : "";
        const title = banner.title || "";
        const description = banner.description || "";
        const tone = banner.tone || "";
        const validity = banner?.validity  ?  new Date(banner.validity).toISOString() :  "";
        const status = banner.status || "";

        /**
         * * Update an existing Banner's serial number and details
         * TODO: Step 1: Find the current serial of the Banner using the provided ID
         *        - Retrieve the Banner record and extract its current serial number
         * TODO: Step 2: Determine the new serial number for the Banner
         *        - If a new serial number is provided:
         *          - If the new serial is greater than the current serial:
         *            - Shift the serial numbers of Banners between currentSerial+1 and targetSerial down by 1
         *          - If the new serial is less than the current serial:
         *            - Shift the serial numbers of Banners between targetSerial and currentSerial-1 up by 1
         *        - If no new serial is provided:
         *          - Keep the same serial number as the current one
         * TODO: Update the Banner with the new serial number and the provided title, description, status, and updatedAt timestamp
         */
        try {
            const currentBanner = await prisma.dashboardBanners.findUnique({
                where: { id: parseInt(params.id) },
            });
            const currentSerial = currentBanner.serial;

            let targetSerial;

            if (newSerial != "") {
                targetSerial = newSerial;

                if (targetSerial > currentSerial) {
                    await prisma.dashboardBanners.updateMany({
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
                    await prisma.dashboardBanners.updateMany({
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

            await prisma.dashboardBanners.update({
                where: { id: parseInt(params.id) },
                data: {
                    serial: parseInt(targetSerial),
                    title: title,
                    description: description,
                    tone: tone,
                    validity: validity,
                    status: status,
                    updatedAt: new Date()
                }
            });
            return {
                target: "success",
                message: "Banner has been updated Successfully",
                data: [],
            }
        } catch (error) {
            createActivityLog({type: "error", shop: "support", subject: "Banner update", body: error});
            return {
                target: "critical",
                message: "Banner creation failed please try again !!",
                data: [],
            }
        }
    }
}

export default function BannerEdit() {
    const loaderData = useLoaderData() || {};
    const actionData = useActionData() || {};
    const submit = useSubmit();
    const navigate = useNavigate();

    const [pageLoader, setPageLoader] = useState(true);
    const [formLoader, setFormLoader] = useState(false);
    const [BannerNotFound, setBannerNotFound] = useState(false);
    const [displayBanner, setDisplayBanner] = useState(false);
    const [readyToRedirect, setReadyToRedirect] = useState(false);

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

  const formatDate = (date) => {
    date = new Date(date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // getMonth() returns month from 0-11
    const day = String(date.getDate()).padStart(2, '0');
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    hours = String(hours).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }

    if(loaderData?.target == "BannerInfo") {
        if(pageLoader) {
            if(loaderData?.data?.id) {
              const formattedDate = loaderData?.data?.validity ?  formatDate(loaderData?.data?.validity): "";
                setFormState({
                    serial: loaderData.data.serial,
                    title: loaderData.data.title,
                    description: loaderData.data.description,
                    tone: loaderData.data.tone,
                    validity: formattedDate,
                    status: loaderData.data.status,
                })
            }
            else {
                setBannerNotFound(true);
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
            submit({ target: "update-banner", data: JSON.stringify(formState) }, { method: "POST" });
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
            navigate("/supports/banners");
        }
    }, [readyToRedirect]);

    return (
        <Page title="Edit Banner">
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
                                <Text as="h1" variant="headingSm">Tone</Text>
                                <SkeletonDisplayText maxWidth='100%' />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap="300">
                                <Text as="h1" variant="headingSm">Validity</Text>
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
            ): BannerNotFound ? (
                <Card padding={600}>
                    <EmptyState
                        heading="Banner not found!"
                        fullWidth={true}
                        action={{
                            content: "Create Banner",
                            url: "/supports/banners/new"
                        }}
                        secondaryAction={{
                            content: "Banner list",
                            url: "/supports/banners/"
                        }}
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                        <p>Sorry! the banner you are looking for was not found.</p>
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
            )}
        </Page>
    );
}
