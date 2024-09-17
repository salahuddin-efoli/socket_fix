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
        return redirect("/supports/articles");
    }
    // Else proceed to regular operations
    return {}
};

export const action = async ({ request }) => {
    const formdata = await request.formData();
    const target = formdata.get('target') || "";
    const data = formdata.get('data') || "";
    // Store article basic  info to the DB
    if (target == "create-article") {
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

        const article = JSON.parse(data);
        const serial = article.serial ? parseInt(article.serial) : "";
        const title = article.title || "";
        const image = article.image || "";
        const url = article.url || "";
        const categories = article.categories || "";
        const date = article?.date  ?  new Date(article.date).toISOString() :  "";
        const status = article.status || "";

        /**
         * * Insert a new Article with the appropriate serial number
         * TODO: Initialize the new serial number to 1 by default
         * TODO: If a specific serial number is provided:
         *        - Shift existing Articles down by one position to make room for the new Article
         *        - Update the serial numbers of Articles that are greater than or equal to the provided serial
         *        - Set the new serial number to the provided value
         * TODO: If no specific serial number is provided:
         *        - Find the current maximum serial number among existing Articles
         *        - Set the new serial number to maxSerial + 1, or 1 if no Articles exist
         * TODO: Create the new Article with the determined serial number and provided title, image, and status
         */
        try {
            let newSerial = 1;
            if (serial != "") {
                await prisma.ourArticles.updateMany({
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
              const maxSerial = await prisma.ourArticles.aggregate({
                    _max: {
                        serial: true,
                    },
                });
                newSerial = (maxSerial._max.serial ?? 0) + 1; // If there are no records, start with serial 1
            }

            await prisma.ourArticles.create({
                data: {
                    serial: parseInt(newSerial),
                    title: title,
                    image: image,
                    url: url,
                    categories: categories,
                    date: date,
                    status: status,
                }
            });

            return {
                target: "success",
                message: "Article has been created Successfully",
                data: [],
            }
        } catch (error) {
            createActivityLog({type: "error", shop: "support", subject: "Article create", body: error});
            return {
                target: "critical",
                message: "Article creation failed please try again !!",
                data: [],
            }
        }
    }
}

export default function ArticleCreate() {
    const actionData = useActionData() || {};
    const submit = useSubmit();

    const [formLoader, setFormLoader] = useState(false);
    const [formState, setFormState] = useState({
        serial: "",
        title: "",
        image: "",
        url: "",
        categories: "",
        date: "",
        status: "ACTIVE",
    });
    const [formError, setFormError] = useState({
        serial: "",
        title: "",
        image: "",
        url: "",
        categories: "",
        date: "",
        status: "",
    });
    const [displayArticle, setDisplayArticle] = useState(false);

    useEffect(() => {
        setFormLoader(false)
    }, [formLoader])

    const handleSerialChange = (newValue) => {
        setFormState({ ...formState, serial: newValue });
    }
    const handleTitleChange = (newValue) => {
        setFormState({ ...formState, title: newValue });
    }
    const handleImageChange = (newValue) => {
        setFormState({ ...formState, image: newValue });
    }
    const handleStatusChange = (newValue) => {
        setFormState({ ...formState, status: newValue });
    }
    const handleUrlChange = (newValue) => {
        setFormState({ ...formState, url: newValue });
    }
    const handleDateChange = (newValue) => {
        setFormState({ ...formState, date: newValue });
    }
    const handleCategoriesChange = (newValue) => {
        setFormState({ ...formState, categories: newValue });
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
        if(!formState.image || formState.image == "") {
            errorMessages.image = "Image url is required";
            validated = false;
        }
        if (!formState.url || formState.url == "") {
            errorMessages.url = "URL is required";
            validated = false;
        }
        if (!formState.date || formState.date == "") {
            errorMessages.date = "date is required";
            validated = false;
        }
        if (!formState.categories || formState.categories == "") {
            errorMessages.categories = "Categories is required";
            validated = false;
        }
        if(!formState.status || formState.status == "") {
            errorMessages.status = "Status is required";
            validated = false;
        }

        if(validated) {
            submit({ target: "create-article", data: JSON.stringify(formState) }, { method: "POST" });
            setDisplayArticle(true);
        }
        else {
            setFormError({ ...errorMessages });
            setFormLoader(false);
        }
    }
    /**
     * These options are used for Article status select
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
                setFormState({ serial: "", title: "", image: "", status: "ACTIVE", date: "" });
                setFormError({ serial: "", title: "", image: "", status: "", date: "" })
            }
        }
    }, [actionData])

    // Hide article display
    const handleBanner = () => {
        setDisplayArticle(false);
    }
    return (
        <Page title="Create Article">
            <BlockStack gap={300}>
                {displayArticle && actionData?.message &&
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
                                <Text as="h1" variant="headingSm">URL</Text>
                                <TextField type="text" placeholder="URL" onChange={handleUrlChange} value={formState.url} />
                                {formError.url && (
                                    <Text as="p" tone="critical">{formError.url}</Text>
                                )}
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={200}>
                                <Text as="h1" variant="headingSm">date</Text>
                                <TextField type="datetime-local" placeholder="Serial" onChange={handleDateChange} value={formState.date}/>
                                {formError.date && (
                                    <Text as="p" tone="critical">{formError.date}</Text>
                                )}
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={200}>
                                <Text as="h1" variant="headingSm">Image url</Text>
                                <TextField type="text" placeholder="Image url" onChange={handleImageChange} value={formState.image} />
                                {formError.image && (
                                    <Text as="p" tone="critical">{formError.image}</Text>
                                )}
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={200}>
                                <Text as="h1" variant="headingSm">Categories</Text>
                                <TextField type="text" placeholder="Categories" onChange={handleCategoriesChange} value={formState.categories} />
                                {formError.categories && (
                                    <Text as="p" tone="critical">{formError.categories}</Text>
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
