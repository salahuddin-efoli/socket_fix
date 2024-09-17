import { BlockStack, Button, Banner, Card, Page, Select, Text, TextField, Grid, InlineStack } from '@shopify/polaris';
import { useEffect, useState } from 'react';
import { redirect, useActionData, useSubmit } from '@remix-run/react';
import prisma from '../../../db.server';
import { authenticator } from "../../../services/auth.server";
import { createActivityLog, getUserAccess } from '../../../libs/helpers';

export const loader = async ({ request }) => {
    const currentAgent = await getUserAccess(request, authenticator, prisma);

    // If current agent do not have access to create operation, redirect him to list page
    if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("PRMSN_CRT")) {
        return redirect("/supports/permissions");
    }
    // Else proceed to regular operations
    return {}
};

export const action = async ({ request }) => {
    const formdata = await request.formData();
    const target = formdata.get('target') || "";
    const data = formdata.get('data') || "";
    // Store permission basic  info to the DB
    if (target == "create-permission") {
        const currentAgent = await getUserAccess(request, authenticator, prisma);

        // If current agent do not have access to create operation, redirect him to list page
        if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("PRMSN_CRT")) {
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
            await prisma.permissions.create({
                data: {
                    code: code,
                    name: name,
                    description: description,
                    status: status,
                }
            });

            return {
                target: "success",
                message: "Permission has been created Successfully",
                data: [],
            }
        } catch (error) {
            createActivityLog({type: "error", shop: "support", subject: "Permission create", body: error});
            return {
                target: "critical",
                message: "Permission creation failed please try again !!",
                data: [],
            }
        }
    }
}

export default function PermissionCreate() {
    const actionData = useActionData() || {};
    const submit = useSubmit();

    const [formLoader, setFormLoader] = useState(false);
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
    const [displayBanner, setDisplayBanner] = useState(false);

    useEffect(() => {
        setFormLoader(false)
    }, [formLoader])

    const handleCodeChange = (newValue) => {
        setFormState({ ...formState, code: newValue });
    }
    const handleNameChange = (newValue) => {
        setFormState({ ...formState, name: newValue });
    }
    const handleDescriptionChange = (newValue) => {
        setFormState({ ...formState, description: newValue });
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
            submit({ target: "create-permission", data: JSON.stringify(formState) }, { method: "POST" });
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
    useEffect(() => {
        if (actionData) {
            if (actionData.target == "success") {
                setFormState({ code: "", name: "", description: "", status: "ACTIVE" });
                setFormError({ code: "", name: "", description: "", status: "" })
            }
        }
    }, [actionData])

    // Hide banner display
    const handleBanner = () => {
        setDisplayBanner(false);
    }
    return (
        <Page title="Create FAQ">
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