import { InlineStack, Card, Tabs, Select, BlockStack, Bleed, Page, Grid, DataTable, Divider, Text, TextField, Button, Badge, IndexTable, Box, useIndexResourceState, useSetIndexFiltersMode, SkeletonTabs, ButtonGroup } from '@shopify/polaris';
import { PlusIcon } from "@shopify/polaris-icons";
import { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { useSubmit, useLoaderData, useActionData, redirect } from '@remix-run/react';
import prisma from "../../../db.server";
import { authenticator } from "../../../services/auth.server";
import { getUserAccess } from '../../../libs/helpers';

export const loader = async ({ request }) => {
    const currentAgent = await getUserAccess(request, authenticator, prisma);

    // If current agent do not have access to create operation, redirect him to list page
    if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("AGT_LST")) {
        return redirect("/supports/agents");
    }
    // Else proceed to regular operations

    const agents = await prisma.supportAgents.findMany({
        select: {
            id: true,
            name: true,
            role: true,
            email: true,
            status: true,
            updatedAt: true
        },
        where: {
            NOT: {
                id: parseInt(currentAgent.id)
            }
        },
        orderBy: {
            id: "desc"
        }
    });

    return {
        target: "agentsList",
        message: "Success",
        data: {
            agentRole: currentAgent.role,
            agentPermissions: currentAgent.permissions,
            agents: agents || []
        }
    }
};

export const action = async ({ request }) => {
    const formdata = await request.formData();
    const target = formdata.get("target");
    const selectedObjectIds = JSON.parse(formdata.get("selectedObjectIds"));

    try {
        const currentAgent = await getUserAccess(request, authenticator, prisma);
        if (target == "delete" && (currentAgent.role == "ADMIN" || currentAgent.permissions.includes("AGT_DLT"))) {
            for (let index = 0; index < selectedObjectIds.length; index++) {
                await prisma.supportAgents.delete({
                    where: {
                        id: selectedObjectIds[index] || 0,
                    }
                });
            }
        }
        else if ((target == "activate" || target == "deactivate") && (currentAgent.role == "ADMIN" || currentAgent.permissions.includes("AGT_EDT"))) {
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
                await prisma.supportAgents.update({
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
            data: {}
        };
    } catch (err) {
        return {
            target: "error",
            message: "Something went wrong",
            data: [],
        };
    }
}

export default function AgentList() {
    const loaderData = useLoaderData();
    const actionData = useActionData();
    const submit = useSubmit();
    const { t } = useTranslation();

    const [pageLoader, setPageLoader] = useState(true);
    const [selectedTab, setSelectedTab] = useState(0);

    const agentRole = loaderData?.data?.agentRole;
    const agentPermissions = loaderData?.data?.agentPermissions;
    const initialAgents = [ ...loaderData.data.agents ];
    const [agents, setAgents] = useState([]);

    const resourceName = {
        singular: 'Agent',
        plural: 'Agents',
    };
    const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection, } = useIndexResourceState(agents);

    useEffect(() => {
		if(loaderData && loaderData.target == "agentsList" && loaderData.message == "Success") {
			if(initialAgents.length > 0) {
                // As the Open tab is opened by default, we have to set opened agent list for this tab
                setAgents(categorizedAgents(0));
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
        // After tab change, set appropriate agent list for that specific tab
        setAgents(categorizedAgents(index));
    };

    const categorizedAgents = (index) => {
        if(index == 0) {
            return initialAgents;
        }
        else if(index == 1) {
            return initialAgents.filter(agent => agent.status == "ACTIVE");
        }
        else if(index == 2) {
            return initialAgents.filter(agent => agent.status == "INACTIVE");
        }
        return [];
    }

    const promotedBulkActions = [];
    if(agentRole == "ADMIN" || agentPermissions.includes("AGT_EDT")) {
        promotedBulkActions.push({
            content: "Activate",
            onAction: () => { bulkAction('activate') },
        },
        {
            content: "Deactivate",
            onAction: () => { bulkAction('deactivate') },
        });
    }
    if(agentRole == "ADMIN" || agentPermissions.includes("AGT_DLT")) {
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
        const selectedObjectIds = getSelectedObjectsId(selectedResources, agents);
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
                            {(agentRole == "ADMIN" || agentPermissions.includes("AGT_CRT")) && (
                                <Button
                                    accessibilityLabel="Create agent"
                                    variant="primary"
                                    size="large"
                                    icon={PlusIcon}
                                    url="/supports/agents/new"
                                >Create agent</Button>
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
                                    selectable={(agentRole == "ADMIN" || agentPermissions.includes("AGT_EDT") || agentPermissions.includes("AGT_DLT")) ? true : false}
                                    promotedBulkActions={promotedBulkActions}
                                    resourceName={resourceName}
                                    itemCount={agents.length}
                                    onSelectionChange={handleSelectionChange}
                                    onNavigation={() => { }}
                                    selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
                                    headings={[
                                        { title: "Name" },
                                        { title: "Email" },
                                        { title: "Status" },
                                        { title: "Updated at" }
                                    ]}
                                >
                                    {agents.map((agent, index) => (
                                        <IndexTable.Row
                                            id={agent.id}
                                            key={agent.id}
                                            position={index}
                                            selected={selectedResources.includes(agent.id)}
                                        >
                                            {(agentRole == "ADMIN" || agentPermissions.includes("AGT_EDT")) ? (
                                                <IndexTable.Cell>
                                                    <Button url={`/supports/agents/${agent.id}`} variant="plain" size="large">
                                                        {agent.name}
                                                    </Button>
                                                </IndexTable.Cell>
                                            ) : (
                                                <IndexTable.Cell>
                                                    <Text variant="headingSm" as="h6">{agent.name}</Text>
                                                </IndexTable.Cell>
                                            )}
                                            <IndexTable.Cell>{agent.email}</IndexTable.Cell>
                                            <IndexTable.Cell>
                                                {agent.status == "ACTIVE" && (
                                                    <Badge tone="success">{"Active"}</Badge>
                                                )}
                                                {agent.status == "INACTIVE" && (
                                                    <Badge tone="attention">{"Inactive"}</Badge>
                                                )}
                                            </IndexTable.Cell>
                                            <IndexTable.Cell>{ agent.updatedAt ? formatDate(agent.updatedAt) : "-" }</IndexTable.Cell>
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
