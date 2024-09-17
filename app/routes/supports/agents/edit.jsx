import { Bleed, BlockStack, Box, Button, Banner, Card, Divider, Page, Select, SkeletonBodyText, Text, TextField, Grid, EmptyState, SkeletonDisplayText, InlineStack, Autocomplete, Tag } from '@shopify/polaris';
import { ListBulletedIcon } from '@shopify/polaris-icons';
import { useEffect, useState } from 'react';
import { redirect, useActionData, useLoaderData, useNavigate, useSubmit } from '@remix-run/react';
import prisma from '../../../db.server';
import { authenticator } from "../../../services/auth.server";
import { createActivityLog, getUserAccess } from '../../../libs/helpers';
import bcryptjs from 'bcryptjs';

export const loader = async ({ request, params }) => {
    const currentAgent = await getUserAccess(request, authenticator, prisma);

    // If current agent do not have access to edit operation, redirect him to list page
    if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("AGT_EDT")) {
        return redirect("/supports/agents");
    }
    // Else proceed to regular operations

    const agent = await prisma.supportAgents.findFirst({
        select: {
            id: true,
            name: true,
            email: true,
            status: true,
            permissions: true,
        },
        where: {
            id: parseInt(params.id)
        }
    });

    const permissions = await prisma.permissions.findMany({
        select: {
            id: true,
            code: true,
            name: true,
        },
        where: {
            status: "ACTIVE"
        }
    });

    return {
        target: "agentInfo",
        message: "Success",
        data: agent,
        permissions: permissions || [],
    }
}

export const action = async ({ request, params }) => {
    const formdata = await request.formData();
    const target = formdata.get('target') || "";
    const data = formdata.get('data') || "";
    // Store agent basic  info to the DB
    if (target == "update-agent") {
        const currentAgent = await getUserAccess(request, authenticator, prisma);

        // If current agent do not have access to edit operation, redirect him to list page
        if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("AGT_EDT")) {
            return {
                target: "critical",
                message: "You do not have permission to perform this operation",
                data: [],
            }
        }
        // Else proceed to regular operations

        const agent = JSON.parse(data);
        const name = agent.name || "";
        const email = agent.email || "";
        const status = agent.status || "";
        const password = agent.password || "";
        const permissions = agent.permissions || [];
        //Find out duplicate email
        const duplicate_email = await prisma.supportAgents.findFirst({
            where: {
                email: email,
                NOT: {
                    id: parseInt(params.id),
                }
            },
            select: { email: true }
        })
        if (duplicate_email) {
            return {
                target: "warning",
                message: "This email has been already taken",
                data: [],
            }
        }

        // Store agents info in DB
        try {
            await prisma.supportAgents.update({
                where: { id: parseInt(params.id) },
                data: {
                    name: name,
                    email: email,
                    status: status,
                    password: password != "" ? bcryptjs.hashSync(password) : undefined,
                    permissions: JSON.stringify(permissions),
                    updatedAt: new Date()
                }
            })
            return {
                target: "success",
                message: "Agent has been updated Successfully",
                data: [],
            }
        } catch (error) {
            createActivityLog({type: "error", shop: "support", subject: "Agent update", body: error});
            return {
                target: "critical",
                message: "Agent creation failed please try again !!",
                data: [],
            }
        }
    }
}

export default function AgentEdit() {
    const loaderData = useLoaderData() || {};
    const actionData = useActionData() || {};
    const submit = useSubmit();
    const navigate = useNavigate();

    const [pageLoader, setPageLoader] = useState(true);
    const [formLoader, setFormLoader] = useState(false);
    const permissionList = loaderData?.permissions?.length > 0 ? loaderData?.permissions?.map((permission) => ({ label: `${permission.name} (${permission.code})`, value: permission.code })) : [];
    const [agentNotFound, setAgentNotFound] = useState(false);
    const [displayBanner, setDisplayBanner] = useState(false);
    const [readyToRedirect, setReadyToRedirect] = useState(false);

    const [selectedPermissionOptions, setSelectedPermissionOptions] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [permissionOptions, setPermissionOptions] = useState(permissionList);

    const [formState, setFormState] = useState({
        name: "",
        email: "",
        status: "ACTIVE",
        password: "",
        permissions: []
    });
    const [formError, setFormError] = useState({
        name: "",
        email: "",
        status: "",
        password: "",
        permissions: "",
    });

    if(loaderData?.target == "agentInfo") {
        if(pageLoader) {
            if(loaderData?.data?.id) {
                setFormState({
                    name: loaderData.data.name,
                    email: loaderData.data.email,
                    status: loaderData.data.status,
                    permissions: loaderData.data.permissions ? JSON.parse(loaderData.data.permissions) : [],
                });
                setSelectedPermissionOptions(loaderData.data.permissions ? JSON.parse(loaderData.data.permissions) : []);
            }
            else {
                setAgentNotFound(true);
            }
            setPageLoader(false);
        }
    }

    const handleNameChange = (newValue) => {
        setFormState({ ...formState, name: newValue });
    }
    const handleEmailChange = (newValue) => {
        setFormState({ ...formState, email: newValue });
    }
    const handleStatusChange = (newValue) => {
        setFormState({ ...formState, status: newValue });
    }
    const handlePasswordChange = (newValue) => {
        setFormState({ ...formState, password: newValue })
    }

    /**
     * * Handle input text changes and filter permission options
     * TODO: Update the input value state with the new value
     * TODO: If the input value is an empty string:
     *        - Reset the permission options to the full permission list
     *        - Exit the function early
     * TODO: If the input value is not empty:
     *        - Create a case-insensitive regular expression from the input value
     *        - Filter the permission list based on the regex to find matching options
     *        - Update the permission options state with the filtered results
     */
    const updateText = (value) => {
        setInputValue(value);
        if (value === '') {
            setPermissionOptions(permissionList);
            return;
        }
        const filterRegex = new RegExp(value, 'i');
        const resultOptions = permissionList.filter((option) => option.label.match(filterRegex));

        setPermissionOptions(resultOptions);
    };

    /**
     * * Remove a selected permission from the list
     * TODO: Copy the current selected permissions into a new array
     * TODO: Find the index of the permission to remove and remove it from the array
     * TODO: Update the selected permissions state with the modified array
     */
    const removePermission = (tag) => () => {
        const permissionOptions = [...selectedPermissionOptions];
        permissionOptions.splice(permissionOptions.indexOf(tag), 1);
        setSelectedPermissionOptions(permissionOptions);
    };

    const verticalContentMarkup = selectedPermissionOptions.length > 0 ? (
        <InlineStack gap={100} alignment="center">
            {selectedPermissionOptions.map(option => <Tag key={`option${option}`} onRemove={removePermission(option)} size="large">{option}</Tag>)}
        </InlineStack>
    ) : null;

    const textField = (
        <Autocomplete.TextField
            onChange={updateText}
            value={inputValue}
            placeholder="Search permissions by name"
            verticalContent={verticalContentMarkup}
            autoComplete="off"
        />
    );

    useEffect(() => {
        setFormState({ ...formState, permissions: [...selectedPermissionOptions] });
    }, [selectedPermissionOptions]);

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
        if(!formState.email || formState.email == "") {
            errorMessages.email = "Email is required";
            validated = false;
        }
        if(!formState.status || formState.status == "") {
            errorMessages.status = "Status is required";
            validated = false;
        }

        if(validated) {
            submit({ target: "update-agent", data: JSON.stringify(formState) }, { method: "POST" });
            setDisplayBanner(true);
        }
        else {
            setFormError({ ...errorMessages });
            setFormLoader(false);
        }
    }

    /**
     * These options are used for agent status select
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
        if (actionData?.target) {
            if(actionData?.target == "success") {
                navigate("/supports/agents");
            }
            if(formLoader) {
                setFormLoader(false);
            }
        }
    }, [actionData]);

    // Hide banner display
    const handleBanner = () => {
        setDisplayBanner(false);
    }

    useEffect(() => {
        if(readyToRedirect) {
            navigate("/supports/agents");
        }
    }, [readyToRedirect]);

    return (
        <Page title="Edit agent">
            {pageLoader ? (
                <Card padding={600}>
                    <Grid>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={300}>
                                <Text as="h1" variant="headingSm">Name</Text>
                                <SkeletonDisplayText maxWidth='100%' />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap="300">
                                <Text as="h1" variant="headingSm">Email</Text>
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
                            <BlockStack gap="300">
                                <Text as="h1" variant="headingSm">Password</Text>
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
            ): agentNotFound ? (
                <Card padding={600}>
                    <EmptyState
                        heading="Agent not found!"
                        fullWidth={true}
                        action={{
                            content: "Create agent",
                            url: "/supports/agents/new"
                        }}
                        secondaryAction={{
                            content: "Agent list",
                            url: "/supports/agents/"
                        }}
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                        <p>Sorry! the agent you are looking for was not found.</p>
                    </EmptyState>
                </Card>
            ) : (
                <BlockStack gap={300}>
                    {displayBanner && actionData?.message &&
                        <Banner title={actionData?.message} tone={actionData?.target} onDismiss={handleBanner} />
                    }
                    <Card padding={600}>
                        <Grid>
                            <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                                <BlockStack gap={300}>
                                    <Text as="h1" variant="headingSm">Name</Text>
                                    <TextField type="text" placeholder="Name" onChange={handleNameChange} value={formState.name} />
                                    {formError.name && (
                                        <Text as="p" tone="critical">{formError.name}</Text>
                                    )}
                                </BlockStack>
                            </Grid.Cell>
                            <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                                <BlockStack gap="300">
                                    <Text as="h1" variant="headingSm">Email</Text>
                                    <TextField type="email" placeholder="Email" onChange={handleEmailChange} value={formState.email} error={actionData?.emailMessage} />
                                    {formError.email && (
                                        <Text as="p" tone="critical">{formError.email}</Text>
                                    )}
                                </BlockStack>
                            </Grid.Cell>
                            <Grid.Cell columnSpan={{ xs: 3, lg: 3 }}>
                                <BlockStack gap="300">
                                    <Text as="h1" variant="headingSm">Status</Text>
                                    <Select options={statusOptions} onChange={handleStatusChange} value={formState.status} />
                                    {formError.status && (
                                        <Text as="p" tone="critical">{formError.status}</Text>
                                    )}
                                </BlockStack>
                            </Grid.Cell>
                            <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                                <BlockStack gap="300">
                                    <Text as="h1" variant="headingSm">Password</Text>
                                    <TextField type="password" placeholder="Password" name="Password" onChange={handlePasswordChange} value={formState.password} />
                                </BlockStack>
                            </Grid.Cell>
                            <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                                <BlockStack gap={100}>
                                    <Text as="h1" variant="headingSm">Permissions</Text>
                                    <Autocomplete
                                        allowMultiple
                                        options={permissionOptions}
                                        selected={selectedPermissionOptions}
                                        textField={textField}
                                        onSelect={setSelectedPermissionOptions}
                                        listTitle="Available permissions"
                                    />
                                    {formError.password && (
                                        <Text as="p" tone="critical">{formError.password}</Text>
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