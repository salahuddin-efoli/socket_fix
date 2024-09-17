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
    if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("PRMSN_EDT")) {
        return redirect("/supports/permissions");
    }
    // Else proceed to regular operations

    const permission = await prisma.permissions.findFirst({
        where: {
            id: parseInt(params.id),
        }
    });

    return {
        target: "permissionInfo",
        message: "Success",
        data: permission
    }
}

export const action = async ({ request, params }) => {
    const formdata = await request.formData();
    const target = formdata.get('target') || "";
    const data = formdata.get('data') || "";
    // Store permission basic  info to the DB
    if (target == "update-permission") {
        const currentAgent = await getUserAccess(request, authenticator, prisma);

        // If current agent do not have access to edit operation, redirect him to list page
        if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("PRMSN_EDT")) {
            return {
                target: "critical",
                message: "You do not have permission to perform this operation",
                data: [],
            }
        }
        // Else proceed to regular operations

        const permission = JSON.parse(data);
        const code = permission.code || "";
        const name = permission.name || "";
        const description = permission.description || "";
        const status = permission.status || "";

        try {
            await prisma.permissions.update({
                where: { id: parseInt(params.id) },
                data: {
                    code: code,
                    name: name,
                    description: description,
                    status: status,
                    updatedAt: new Date()
                }
            });
            return {
                target: "success",
                message: "Permission has been updated Successfully",
                data: [],
            }
        } catch (error) {
            createActivityLog({type: "error", shop: "support", subject: "Permission update", body: error});
            return {
                target: "critical",
                message: "Permission creation failed please try again !!",
                data: [],
            }
        }
    }
}

export default function PermissionEdit() {
    const loaderData = useLoaderData() || {};
    const actionData = useActionData() || {};
    const submit = useSubmit();
    const navigate = useNavigate();

    const [pageLoader, setPageLoader] = useState(true);
    const [formLoader, setFormLoader] = useState(false);
    const [permissionNotFound, setPermissionNotFound] = useState(false);
    const [displayBanner, setDisplayBanner] = useState(false);
    const [readyToRedirect, setReadyToRedirect] = useState(false);

    const [formState, setFormState] = useState({
        code: "",
        name: "",
        description: "",
        status: "ACTIVE",
    });
    const [formError, setFormError] = useState({
        code: "",
        name: "",
        description: "",
        status: "",
    });

    if(loaderData?.target == "permissionInfo") {
        if(pageLoader) {
            if(loaderData?.data?.id) {
                setFormState({
                    code: loaderData.data.code,
                    name: loaderData.data.name,
                    description: loaderData.data.description,
                    status: loaderData.data.status,
                })
            }
            else {
                setPermissionNotFound(true);
            }
            setPageLoader(false);
        }
    }

    const handleCodeChange = (newValue) => {
        setFormState({ ...formState, code: newValue });
    }
    const handleNameChange = (newValue) => {
        setFormState({ ...formState, name: newValue });
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
        if(!formState.name || formState.name == "") {
            errorMessages.name = "Name is required";
            validated = false;
        }
        if(!formState.code || formState.code == "") {
            errorMessages.code = "Code is required";
            validated = false;
        }
        if(!formState.status || formState.status == "") {
            errorMessages.status = "Status is required";
            validated = false;
        }

        if(validated) {
            submit({ target: "update-permission", data: JSON.stringify(formState) }, { method: "POST" });
            setDisplayBanner(true);
        }
        else {
            setFormError({ ...errorMessages });
            setFormLoader(false);
        }
    }
    /**
     * These options are used for permission status select
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
            navigate("/supports/permissions");
        }
    }, [readyToRedirect]);

    return (
        <Page title="Edit FAQ">
            {pageLoader ? (
                <Card padding={600}>
                    <Grid>
                    <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                            <BlockStack gap="300">
                                <Text as="h1" variant="headingSm">Name</Text>
                                <SkeletonDisplayText maxWidth='100%' />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={300}>
                                <Text as="h1" variant="headingSm">Code</Text>
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
            ): permissionNotFound ? (
                <Card padding={600}>
                    <EmptyState
                        heading="Permission not found!"
                        fullWidth={true}
                        action={{
                            content: "Create permission",
                            url: "/supports/permissions/new"
                        }}
                        secondaryAction={{
                            content: "Permission list",
                            url: "/supports/permissions/"
                        }}
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                        <p>Sorry! the permission you are looking for was not found.</p>
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
                                    <Text as="h1" variant="headingSm">Name</Text>
                                    <TextField type="text" placeholder="Name" onChange={handleNameChange} value={formState.name} />
                                    {formError.name && (
                                        <Text as="p" tone="critical">{formError.name}</Text>
                                    )}
                                </BlockStack>
                            </Grid.Cell>
                            <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                                <BlockStack gap={200}>
                                    <Text as="h1" variant="headingSm">Code</Text>
                                    <TextField type="text" placeholder="Code" onChange={handleCodeChange} value={formState.code} />
                                    {formError.code && (
                                        <Text as="p" tone="critical">{formError.code}</Text>
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