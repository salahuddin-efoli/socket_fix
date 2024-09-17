import { InlineStack, Card, Tabs, Select, BlockStack, Bleed, Page, Grid, DataTable, Divider, Text, TextField, Button, Badge, IndexTable, Box, useIndexResourceState, useSetIndexFiltersMode, SkeletonTabs, ButtonGroup } from '@shopify/polaris';
import { PlusIcon } from "@shopify/polaris-icons";
import { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { useSubmit, useLoaderData, useActionData } from '@remix-run/react';
import prisma from "../../../db.server";
import { authenticator } from "../../../services/auth.server";
import { getUserAccess } from '../../../libs/helpers';

export const loader = async ({ request }) => {
    const currentAgent = await getUserAccess(request, authenticator, prisma);

    // If current agent do not have access to create operation, redirect him to list page
    if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("PRMSN_LST")) {
        return redirect("/supports/permissions");
    }
    // Else proceed to regular operations

    const permissions = await prisma.permissions.findMany({
        select: {
            id: true,
            code: true,
            name: true,
            description: true,
            status: true,
            updatedAt: true,
        }
    });

    return {
        target: "permissionsList",
        message: "Success",
        data: {
            agentRole: currentAgent.role,
            agentPermissions: currentAgent.permissions,
            permissions: permissions || []
        }
    }
};

export const action = async ({ request }) => {
    const formdata = await request.formData();
    const target = formdata.get("target");
    const selectedObjectIds = JSON.parse(formdata.get("selectedObjectIds"));

    try {
        const currentAgent = await getUserAccess(request, authenticator, prisma);
        if (target == "delete" && (currentAgent.role == "ADMIN" || currentAgent.permissions.includes("PRMSN_DLT"))) {
            for (let index = 0; index < selectedObjectIds.length; index++) {
                await prisma.permissions.delete({
                    where: {
                        id: selectedObjectIds[index] || 0,
                    }
                });
            }
        }
        else if ((target == "activate" || target == "deactivate") && (currentAgent.role == "ADMIN" || currentAgent.permissions.includes("PRMSN_EDT"))) {
            // Set data object for appropriate data target
            let data = {};
            if (target == "activate") {
                data.status = "ACTIVE";
                data.updatedAt = new Date();
            }
            else if (target == "deactivate") {
                data.status = "INACTIVE";
                data.updatedAt = new Date();
            }
            for (let index = 0; index < selectedObjectIds.length; index++) {
                await prisma.permissions.update({
                    where: {
                        id: selectedObjectIds[index] || 0,
                    },
                    data: { ...data },
                });
            }
        }
        return {
            target: target,
            message: "Success",
            data: {},
        };
    } catch (err) {
        return {
            target: "error",
            message: "Something went wrong",
            data: [],
        };
    }
}

export default function PermissionList() {
    const loaderData = useLoaderData();
    const actionData = useActionData();
    const submit = useSubmit();
    const { t } = useTranslation();

    const [pageLoader, setPageLoader] = useState(true);
    const [selectedTab, setSelectedTab] = useState(0);

    const agentRole = loaderData?.data?.agentRole;
    const agentPermissions = loaderData?.data?.agentPermissions;
    const initialPermissions = [ ...loaderData.data.permissions ];
    const [permissions, setPermissions] = useState([]);

    const resourceName = {
        singular: 'permission',
        plural: 'permissions',
    };
    const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection, } = useIndexResourceState(permissions);

    useEffect(() => {
		if(loaderData && loaderData.target == "permissionsList" && loaderData.message == "Success") {
			if(initialPermissions.length > 0) {
                // As the Open tab is opened by default, we have to set opened permission list for this tab
                setPermissions(categorizedPermissions(0));
            }

            if(pageLoader) {
                setPageLoader(false);
            }
		}
	}, []);

    const formatDate = (date) => {
        date = new Date(date);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // getMonth() returns month from 0-11
        const day = String(date.getDate()).padStart(2, '0');
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        hours = String(hours).padStart(2, '0');

        return `${hours}:${minutes}:${seconds} ${ampm} ${day}-${month}-${year}`;
    }

    const handleTabChange = (index) => {
        setSelectedTab(index);
        // After tab change, set appropriate permission list for that specific tab
        setPermissions(categorizedPermissions(index));
    };

    const categorizedPermissions = (index) => {
        if(index == 0) {
            return initialPermissions;
        }
        else if(index == 1) {
            return initialPermissions.filter(permission => permission.status == "ACTIVE");
        }
        else if(index == 2) {
            return initialPermissions.filter(permission => permission.status == "INACTIVE");
        }
        return [];
    }

    const promotedBulkActions = [];
    if(agentRole == "ADMIN" || agentPermissions.includes("PRMSN_EDT")) {
        promotedBulkActions.push({
            content: "Activate",
            onAction: () => { bulkAction('activate') },
        },
        {
            content: "Deactivate",
            onAction: () => { bulkAction('deactivate') },
        });
    }
    if(agentRole == "ADMIN" || agentPermissions.includes("PRMSN_DLT")) {
        promotedBulkActions.push({
            content: "Delete",
            onAction: () => { bulkAction('delete') },
        });
    }

    //get discountId array from selected row cells
    function getSelectedObjectsId(currentArr, mainArr) {
        return mainArr.filter((obj) => currentArr.includes(obj.id)).map((obj) => obj.id);
    }

    const bulkAction = (target) => {
        setPageLoader(true);
        const selectedObjectIds = getSelectedObjectsId(selectedResources, permissions);
        submit({ target: target, selectedObjectIds: JSON.stringify(selectedObjectIds), }, { method: "POST" });
    };

    useEffect(() => {
        if(actionData) {
            if (actionData.message == "Success") {
                if (pageLoader == true) {
                    if (actionData.target == "activate" || actionData.target == "deactivate" || actionData.target == "delete") {
                        window.location.reload();
                    }
                }
            }
        }
	}, [actionData]);

    return (
        <Bleed>
            <Page fullWidth>
                <Card>
                    <BlockStack gap={300}>
                        <InlineStack align="space-between">
                            <ButtonGroup>
                                <Button variant="tertiary" pressed={selectedTab == 0} onClick={() => handleTabChange(0)}>All</Button>
                                <Button variant="tertiary" pressed={selectedTab == 1} onClick={() => handleTabChange(1)}>Active</Button>
                                <Button variant="tertiary" pressed={selectedTab == 2} onClick={() => handleTabChange(2)}>Inactive</Button>
                            </ButtonGroup>
                            {(agentRole == "ADMIN" || agentPermissions.includes("PRMSN_CRT")) && (
                                <Button
                                    accessibilityLabel="Create permission"
                                    variant="primary"
                                    size="large"
                                    icon={PlusIcon}
                                    url="/supports/permissions/new"
                                >Create permission</Button>
                            )}
                        </InlineStack>
                        <Divider />
                        <Box>
                            {pageLoader ? (
                                <Box paddingBlock={200}>
                                    <BlockStack>
                                        {[...Array(5)].map((e, i) => (
                                            <SkeletonTabs count={5} fitted key={i} />
                                        ))}
                                    </BlockStack>
                                </Box>
                            ) : (
                                <IndexTable
                                    selectable={(agentRole == "ADMIN" || agentPermissions.includes("PRMSN_EDT") || agentPermissions.includes("PRMSN_DLT")) ? true : false}
                                    promotedBulkActions={promotedBulkActions}
                                    resourceName={resourceName}
                                    itemCount={permissions.length}
                                    onSelectionChange={handleSelectionChange}
                                    onNavigation={() => { }}
                                    selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
                                    headings={[
                                        { title: "Name" },
                                        { title: "Code" },
                                        { title: "Status" },
                                        { title: "Updated at" }
                                    ]}
                                >
                                    {permissions.map((permission, index) => (
                                        <IndexTable.Row
                                            id={permission.id}
                                            key={permission.id}
                                            position={index}
                                            selected={selectedResources.includes(permission.id)}
                                        >
                                            {(agentRole == "ADMIN" || agentPermissions.includes("PRMSN_EDT")) ? (
                                                <IndexTable.Cell>
                                                    <Button url={`/supports/permissions/${permission.id}`} variant="plain" size="large">
                                                        {permission.name}
                                                    </Button>
                                                </IndexTable.Cell>
                                            ) : (
                                                <IndexTable.Cell>
                                                    <Text variant="headingSm" as="h6">{permission.name}</Text>
                                                </IndexTable.Cell>
                                            )}
                                            <IndexTable.Cell>{permission.code}</IndexTable.Cell>
                                            <IndexTable.Cell>
                                                {permission.status == "ACTIVE" && (
                                                    <Badge tone="success">{"Active"}</Badge>
                                                )}
                                                {permission.status == "INACTIVE" && (
                                                    <Badge tone="attention">{"Inactive"}</Badge>
                                                )}
                                            </IndexTable.Cell>
                                            <IndexTable.Cell>{ permission.updatedAt ? formatDate(permission.updatedAt) : "-" }</IndexTable.Cell>
                                        </IndexTable.Row>
                                    ))}
                                </IndexTable>
                            )}
                        </Box>
                    </BlockStack>
                </Card>
            </Page>
        </Bleed>
    );
}
