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
    if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("FRQ_LST")) {
        return redirect("/supports/feature-requests");
    }
    // Else proceed to regular operations

    const featureRequests = await prisma.featureRequests.findMany({
        select: {
            id: true,
            serial: true,
            title: true,
            description: true,
            postedBy: true,
            shopId: true,
            status: true,
            updatedAt: true,
            deletedAt: true,
            shop: {
                select: {
                    name: true
                }
            }
        },
        orderBy: {
            serial: "asc"
        }
    });

    return {
        target: "featureRequestsList",
        message: "Success",
        data: {
            agentRole: currentAgent.role,
            agentPermissions: currentAgent.permissions,
            featureRequests: featureRequests || []
        }
    }
};

export const action = async ({ request }) => {
    const formdata = await request.formData();
    const target = formdata.get("target");
    const selectedObjectIds = JSON.parse(formdata.get("selectedObjectIds"));

    const currentAgent = await getUserAccess(request, authenticator, prisma);
    // Set data object for appropriate data target
    let data = {};
    if (target == "delete" && (currentAgent.role == "ADMIN" || currentAgent.permissions.includes("FRQ_DLT"))) {
        data.deletedAt = new Date();
    }
    else if (target == "re-store" && (currentAgent.role == "ADMIN" || currentAgent.permissions.includes("FRQ_RST"))) {
        data.deletedAt = null;
    }
    else if (target == "approve" && (currentAgent.role == "ADMIN" || currentAgent.permissions.includes("FRQ_EDT"))) {
        data.status = "APPROVED";
        data.updatedAt = new Date();
    }
    else if (target == "archive" && (currentAgent.role == "ADMIN" || currentAgent.permissions.includes("FRQ_EDT"))) {
        data.status = "ARCHIVED";
        data.updatedAt = new Date();
    }
    try {
        for (let index = 0; index < selectedObjectIds.length; index++) {
            const featureRequestId = selectedObjectIds[index] || "";
            await prisma.featureRequests.update({
                where: {
                    id: featureRequestId,
                },
                data: { ...data },
            });
        }

        const featureRequests = await prisma.featureRequests.findMany({
            select: {
                id: true,
                serial: true,
                title: true,
                description: true,
                postedBy: true,
                shopId: true,
                status: true,
                updatedAt: true,
                deletedAt: true,
                shop: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        return {
            target: target,
            message: "Success",
            data: featureRequests,
        };
    } catch (err) {
        return {
            target: "error",
            message: "Something went wrong",
            data: [],
        };
    }
}

export default function FeatureRequestList() {
    const loaderData = useLoaderData();
    const actionData = useActionData();
    const submit = useSubmit();
    const { t } = useTranslation();

    const [pageLoader, setPageLoader] = useState(true);
    const [selectedTab, setSelectedTab] = useState(0);

    const agentRole = loaderData?.data?.agentRole;
    const agentPermissions = loaderData?.data?.agentPermissions;
    const initialFeatureRequests = [ ...loaderData.data.featureRequests ];
    const [featureRequests, setFeatureRequests] = useState([]);

    const resourceName = {
        singular: 'feature request',
        plural: 'feature requests',
    };
    const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection, } = useIndexResourceState(featureRequests);

    useEffect(() => {
		if(loaderData && loaderData.target == "featureRequestsList" && loaderData.message == "Success") {
			if(initialFeatureRequests.length > 0) {
                // As the Open tab is opened by default, we have to set opened feature request list for this tab
                setFeatureRequests(categorizedFeatureRequests(0));
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
        // After tab change, set appropriate feature request list for that specific tab
        setFeatureRequests(categorizedFeatureRequests(index));
    };

    const categorizedFeatureRequests = (index) => {
        if(index == 0) {
            return initialFeatureRequests;
        }
        else if(index == 1) {
            return initialFeatureRequests.filter(featureRequest => featureRequest.status == "APPROVED");
        }
        else if(index == 2) {
            return initialFeatureRequests.filter(featureRequest => featureRequest.status == "ARCHIVED");
        }
        else if(index == 3) {
            return initialFeatureRequests.filter(featureRequest => featureRequest.deletedAt != null);
        }
        return [];
    }

    const promotedBulkActions = [];
    if(agentRole == "ADMIN" || agentPermissions.includes("FRQ_EDT")) {
        promotedBulkActions.push({
            content: "Approve feature requests",
            onAction: () => { bulkAction("approve") },
        },
        {
            content: "Archive feature requests",
            onAction: () => { bulkAction("archive") },
        });
    }
    if(agentRole == "ADMIN" || agentPermissions.includes("FRQ_DLT")) {
        promotedBulkActions.push({
            content: "Delete feature requests",
            onAction: () => { bulkAction("delete") },
        });
    }
    if(agentRole == "ADMIN" || agentPermissions.includes("FRQ_RST")) {
        promotedBulkActions.push({
            content: "Re-store feature requests",
            onAction: () => { bulkAction("re-store") },
        });
    }

    //get discountId array from selected row cells
    function getSelectedObjectsId(currentArr, mainArr) {
        return mainArr.filter((obj) => currentArr.includes(obj.id)).map((obj) => obj.id);
    }

    const bulkAction = (target) => {
        setPageLoader(true);
        const selectedObjectIds = getSelectedObjectsId(selectedResources, featureRequests);
        submit({ target: target, selectedObjectIds: JSON.stringify(selectedObjectIds), }, { method: "POST" });
    };

    useEffect(() => {
        if(actionData) {
            if (actionData.message == "Success") {
                if (pageLoader == true) {
                    if (actionData.target == "delete" || actionData.target == "re-store" || actionData.target == "approve" || actionData.target == "archive") {
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
                                {(agentRole == "ADMIN" || agentPermissions.includes("FRQ_DLT") || agentPermissions.includes("FRQ_RST")) && (
                                    <Button variant="tertiary" pressed={selectedTab == 3} onClick={() => handleTabChange(3)}>Deleted</Button>
                                )}
                            </ButtonGroup>
                            {(agentRole == "ADMIN" || agentPermissions.includes("FRQ_CRT")) && (
                                <Button
                                    accessibilityLabel="Create feature request"
                                    variant="primary"
                                    size="large"
                                    icon={PlusIcon}
                                    url="/supports/feature-requests/new"
                                >Create feature request</Button>
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
                                    selectable={(agentRole == "ADMIN" || agentPermissions.includes("FRQ_EDT") || agentPermissions.includes("FRQ_DLT") || agentPermissions.includes("FRQ_RST")) ? true : false}
                                    promotedBulkActions={promotedBulkActions}
                                    resourceName={resourceName}
                                    itemCount={featureRequests.length}
                                    onSelectionChange={handleSelectionChange}
                                    onNavigation={() => { }}
                                    selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
                                    headings={[
                                        { title: "Serial" },
                                        { title: "Title" },
                                        { title: "Posted by" },
                                        { title: "Shop" },
                                        { title: "Status" },
                                        { title: "Updated at" }
                                    ]}
                                >
                                    {featureRequests.map((featureRequest, index) => (
                                        <IndexTable.Row
                                            id={featureRequest.id}
                                            key={featureRequest.id}
                                            position={index}
                                            selected={selectedResources.includes(featureRequest.id)}
                                        >
                                            <IndexTable.Cell>{featureRequest.serial}</IndexTable.Cell>
                                            {(agentRole == "ADMIN" || agentPermissions.includes("FRQ_EDT")) ? (
                                                <IndexTable.Cell>
                                                    <Button url={`/supports/feature-requests/${featureRequest.id}`} variant="plain" size="large">
                                                        {featureRequest.title}
                                                    </Button>
                                                </IndexTable.Cell>
                                            ) : (
                                                <IndexTable.Cell>
                                                    <Text variant="headingSm" as="h6">{featureRequest.title}</Text>
                                                </IndexTable.Cell>
                                            )}
                                            <IndexTable.Cell>{featureRequest.postedBy}</IndexTable.Cell>
                                            <IndexTable.Cell>{featureRequest.shop.name}</IndexTable.Cell>
                                            <IndexTable.Cell>
                                                {featureRequest.deletedAt && (
                                                    <Badge tone="critical">{"Deleted"}</Badge>
                                                )}
                                                {featureRequest.status == "PENDING" && (
                                                    <Badge tone="attention">{"Pending"}</Badge>
                                                )}
                                                {featureRequest.status == "APPROVED" && (
                                                    <Badge tone="success">{"Approved"}</Badge>
                                                )}
                                                {featureRequest.status == "ARCHIVED" && (
                                                    <Badge tone="attention">{"Archived"}</Badge>
                                                )}
                                            </IndexTable.Cell>
                                            <IndexTable.Cell>{ featureRequest.updatedAt ? formatDate(featureRequest.updatedAt) : "-" }</IndexTable.Cell>
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
