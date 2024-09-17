import { BlockStack, Button, Banner, Card, Page, Select, Text, TextField, Grid, InlineStack, Autocomplete, Tag } from '@shopify/polaris';
import { useEffect, useState } from 'react';
import { redirect, useActionData, useLoaderData, useSubmit } from '@remix-run/react';
import prisma from '../../../db.server';
import { authenticator } from "../../../services/auth.server";
import { createActivityLog, getUserAccess } from '../../../libs/helpers';
import bcryptjs from 'bcryptjs';

export const loader = async ({ request }) => {
    const currentAgent = await getUserAccess(request, authenticator, prisma);

    // If current agent do not have access to create operation, redirect him to list page
    if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("AGT_CRT")) {
        return redirect("/supports/agents");
    }
    // Else proceed to regular operations

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
        target: "permissionsList",
        message: "Success",
        data: {},
        permissions: permissions || [],
    }
};

export const action = async ({ request }) => {
    const formdata = await request.formData();
    const target = formdata.get('target') || "";
    const data = formdata.get('data') || "";
    // Store agent basic  info to the DB
    if (target == "create-agent") {
        const currentAgent = await getUserAccess(request, authenticator, prisma);

        // If current agent do not have access to create operation, redirect him to list page
        if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("AGT_CRT")) {
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
            where: { email: email }, select: { email: true }, orderBy: { id: 'desc' }
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
            await prisma.supportAgents.create({
                data: {
                    name: name,
                    email: email,
                    status: status,
                    password: bcryptjs.hashSync(password),
                    permissions: JSON.stringify(permissions),
                }
            })
            return {
                target: "success",
                message: "Agent has been created Successfully",
                data: [],
            }
        } catch (error) {
            createActivityLog({type: "error", shop: "support", subject: "Agent create", body: error});
            return {
                target: "critical",
                message: "Agent creation failed please try again !!",
                data: [],
            }
        }
    }
}

export default function AgentCreate() {
    const loaderData = useLoaderData() || {};
    const actionData = useActionData() || {};
    const submit = useSubmit();

    const [formLoader, setFormLoader] = useState(false);
    const permissionList = loaderData?.permissions?.length > 0 ? loaderData?.permissions?.map((permission) => ({ label: `${permission.name} (${permission.code})`, value: permission.code })) : [];

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
    const [displayBanner, setDisplayBanner] = useState(false);

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
        setFormState({ ...formState, password: newValue });
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
        if(!formState.password || formState.password == "") {
            errorMessages.password = "Password is required";
            validated = false;
        }

        if(validated) {
            submit({ target: "create-agent", data: JSON.stringify(formState) }, { method: "POST" });
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
        if (actionData) {
            if (actionData.target == "success") {
                setFormState({ name: "", email: "", status: "ACTIVE", password: "", permissions: [] });
                setFormError({ name: "", email: "", status: "", password: "" });
                setSelectedPermissionOptions([]);
            }
        }
        if(formLoader) {
            setFormLoader(false);
        }
    }, [actionData])

    // Hide banner display
    const handleBanner = () => {
        setDisplayBanner(false);
    }
    return (
        <Page title="Create agent">
            <BlockStack gap={300}>
                {displayBanner && actionData?.message &&
                    <Banner title={actionData?.message} tone={actionData?.target} onDismiss={handleBanner} />
                }
                <Card padding={600}>
                    <Grid>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={100}>
                                <Text as="h1" variant="headingSm">Name</Text>
                                <TextField type="text" placeholder="Name" onChange={handleNameChange} value={formState.name} />
                                {formError.name && (
                                    <Text as="p" tone="critical">{formError.name}</Text>
                                )}
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={100}>
                                <Text as="h1" variant="headingSm">Email</Text>
                                <TextField type="email" placeholder="Email" onChange={handleEmailChange} value={formState.email} error={actionData?.emailMessage} />
                                {formError.email && (
                                    <Text as="p" tone="critical">{formError.email}</Text>
                                )}
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 3, lg: 3 }}>
                            <BlockStack gap={100}>
                                <Text as="h1" variant="headingSm">Status</Text>
                                <Select options={statusOptions} onChange={handleStatusChange} value={formState.status} />
                                {formError.status && (
                                    <Text as="p" tone="critical">{formError.status}</Text>
                                )}
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={100}>
                                <Text as="h1" variant="headingSm">Password</Text>
                                <TextField type="password" placeholder="Password" name="Password" onChange={handlePasswordChange} value={formState.password} />
                                {formError.password && (
                                    <Text as="p" tone="critical">{formError.password}</Text>
                                )}
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
        </Page>
    );
}