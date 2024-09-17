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
    if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("ART_EDT")) {
        return redirect("/supports/articles");
    }
    // Else proceed to regular operations

    const article = await prisma.ourArticles.findFirst({
        where: {
            id: parseInt(params.id)
        }
    });

    return {
        target: "ArticleInfo",
        message: "Success",
        data: article
    }
}

export const action = async ({ request, params }) => {
    const formdata = await request.formData();
    const target = formdata.get('target') || "";
    const data = formdata.get('data') || "";
    // Store article basic  info to the DB
    if (target == "update-article") {
        const currentAgent = await getUserAccess(request, authenticator, prisma);

        // If current agent do not have access to edit operation, redirect him to list page
        if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("ART_EDT")) {
            return {
                target: "critical",
                message: "You do not have permission to perform this operation",
                data: [],
            }
        }
        // Else proceed to regular operations

        const article = JSON.parse(data);
        const newSerial = article.serial ? parseInt(article.serial) : "";
        const title = article.title || "";
        const image = article.image || "";
        const url = article.url || "";
        const categories = article.categories || "";
        const date = article?.date  ?  new Date(article.date).toISOString() :  "";
        const status = article.status || "";

        /**
         * * Update an existing Article's serial number and details
         * TODO: Step 1: Find the current serial of the Article using the provided ID
         *        - Retrieve the Article record and extract its current serial number
         * TODO: Step 2: Determine the new serial number for the Article
         *        - If a new serial number is provided:
         *          - If the new serial is greater than the current serial:
         *            - Shift the serial numbers of Articles between currentSerial+1 and targetSerial down by 1
         *          - If the new serial is less than the current serial:
         *            - Shift the serial numbers of Articles between targetSerial and currentSerial-1 up by 1
         *        - If no new serial is provided:
         *          - Keep the same serial number as the current one
         * TODO: Update the Article with the new serial number and the provided title, description, status, and updatedAt timestamp
         */
        try {
            const currentArticle = await prisma.ourArticles.findUnique({
                where: { id: parseInt(params.id) },
            });
            const currentSerial = currentArticle.serial;

            let targetSerial;

            if (newSerial != "") {
                targetSerial = newSerial;

                if (targetSerial > currentSerial) {
                    await prisma.ourArticles.updateMany({
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
                    await prisma.ourArticles.updateMany({
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

            await prisma.ourArticles.update({
                where: { id: parseInt(params.id) },
                data: {
                    serial: parseInt(targetSerial),
                    title: title,
                    image: image,
                    url: url,
                    categories: categories,
                    date: date,
                    status: status,
                    updatedAt: new Date()
                }
            });
            return {
                target: "success",
                message: "Article has been updated Successfully",
                data: [],
            }
        } catch (error) {
            createActivityLog({type: "error", shop: "support", subject: "Article update", body: error});
            return {
                target: "critical",
                message: "Article creation failed please try again !!",
                data: [],
            }
        }
    }
}

export default function ArticleEdit() {
    const loaderData = useLoaderData() || {};
    const actionData = useActionData() || {};
    const submit = useSubmit();
    const navigate = useNavigate();

    const [pageLoader, setPageLoader] = useState(true);
    const [formLoader, setFormLoader] = useState(false);
    const [ArticleNotFound, setArticleNotFound] = useState(false);
    const [displayArticle, setDisplayArticle] = useState(false);
    const [readyToRedirect, setReadyToRedirect] = useState(false);

    const [formState, setFormState] = useState({
        sserial: "",
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

    if(loaderData?.target == "ArticleInfo") {
        if(pageLoader) {
            if(loaderData?.data?.id) {
              const formattedDate = loaderData?.data?.date ?  formatDate(loaderData?.data?.date): "";
                setFormState({
                    serial: loaderData.data.serial,
                    title: loaderData.data.title,
                    image: loaderData.data.image,
                    url: loaderData.data.url,
                    categories: loaderData.data.categories,
                    date: formattedDate,
                    status: loaderData.data.status,
                })
            }
            else {
                setArticleNotFound(true);
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
            submit({ target: "update-article", data: JSON.stringify(formState) }, { method: "POST" });
            setDisplayArticle(true);
        }
        else {
            setFormError({ ...errorMessages });
            setFormLoader(false);
        }
    }
    /**
     * These options are used for article status select
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

    // Hide article display
    const handleBanner = () => {
        setDisplayArticle(false);
    }

    useEffect(() => {
        if(readyToRedirect) {
            navigate("/supports/articles");
        }
    }, [readyToRedirect]);

    return (
        <Page title="Edit Article">
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
                                <Text as="h1" variant="headingSm">URl</Text>
                                <SkeletonDisplayText maxWidth='100%' />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap="300">
                                <Text as="h1" variant="headingSm">date</Text>
                                <SkeletonDisplayText maxWidth='100%' />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap="300">
                                <Text as="h1" variant="headingSm">Image url</Text>
                                <SkeletonDisplayText maxWidth='100%' />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap="300">
                                <Text as="h1" variant="headingSm">Categories</Text>
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
                            <Button variant="primary" size="large" disabled>
                                Submit
                            </Button>
                        </Grid.Cell>
                    </Grid>
                </Card>
            ): ArticleNotFound ? (
                <Card padding={600}>
                    <EmptyState
                        heading="Article not found!"
                        fullWidth={true}
                        action={{
                            content: "Create Article",
                            url: "/supports/articles/new"
                        }}
                        secondaryAction={{
                            content: "Article list",
                            url: "/supports/articles/"
                        }}
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                        <p>Sorry! the article you are looking for was not found.</p>
                    </EmptyState>
                </Card>
            ) : (
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
                                <Text as="h1" variant="headingSm">Date</Text>
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
            )}
        </Page>
    );
}
