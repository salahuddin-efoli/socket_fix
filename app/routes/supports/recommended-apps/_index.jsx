import { InlineStack, Card, Tabs, Select, BlockStack, Bleed, Page, Grid, DataTable, Divider, Text, TextField, Button, Badge, IndexTable, Box, useIndexResourceState, useSetIndexFiltersMode, SkeletonTabs, ButtonGroup } from '@shopify/polaris';
import { PlusIcon } from "@shopify/polaris-icons";
import { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { useSubmit, useLoaderData, useActionData } from '@remix-run/react';
import prisma from "../../../db.server";
import { authenticator } from "../../../services/auth.server";
import { getUserAccess } from '../../../libs/helpers';
import path from 'path';
import fs from "fs";

export const loader = async ({ request }) => {
    const currentAgent = await getUserAccess(request, authenticator, prisma);

    // If current agent do not have access to create operation, redirect him to list page
    if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("RAPP_LST")) {
        return redirect("/supports/recommended-apps");
    }
    // Else proceed to regular operations

    const recommendedApps = await prisma.recommendedApps.findMany({
        select: {
            id: true,
            serial: true,
            name: true,
            image: true,
            validity: true,
            description: true,
            url: true,
            status: true,
            updatedAt: true,
        },
        orderBy: {
            serial: "asc"
        }
    });

    return {
        target: "recommendedAppsList",
        message: "Success",
        data: {
            agentRole: currentAgent.role,
            agentPermissions: currentAgent.permissions,
            recommendedApps: recommendedApps || []
        }
    }
};

export const action = async ({ request }) => {
    const formdata = await request.formData();
    const target = formdata.get("target");
    const selectedObjectIds = JSON.parse(formdata.get("selectedObjectIds"));

    try {
        const currentAgent = await getUserAccess(request, authenticator, prisma);
        if (target == "delete" && (currentAgent.role == "ADMIN" || currentAgent.permissions.includes("RAPP_DLT"))) {
            for (let index = 0; index < selectedObjectIds.length; index++) {

                let app = await prisma.recommendedApps.findFirst({
                    select:{
                        id: true,
                        image: true,
                    },
                    where: {
                        id: selectedObjectIds[index] || 0,
                    }
                });

                if(app?.id) {
                    const imageDir = app?.image;
                    // Delete the old image if file exists
                    if (imageDir && fs.existsSync(path.join("public", imageDir))) {
                        fs.unlinkSync(path.join("public", imageDir))
                    }
                    await prisma.recommendedApps.delete({
                        where: {
                            id: selectedObjectIds[index] || 0,
                        }
                    });
                }
            }
        }
        else if ((target == "activate" || target == "deactivate") && (currentAgent.role == "ADMIN" || currentAgent.permissions.includes("RAPP_EDT"))) {
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
                await prisma.recommendedApps.update({
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

export default function BannerList() {
    const loaderData = useLoaderData();
    const actionData = useActionData();
    const submit = useSubmit();
    const { t } = useTranslation();

    const [pageLoader, setPageLoader] = useState(true);
    const [selectedTab, setSelectedTab] = useState(0);

    const agentRole = loaderData?.data?.agentRole;
    const agentPermissions = loaderData?.data?.agentPermissions;
    const initialRecommendedApps = [ ...loaderData.data.recommendedApps ];
    const [recommendedApps, setRecommendedApps] = useState([]);

    const resourceName = {
        singular: 'Recommended app',
        plural: 'Recommended apps',
    };
    const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection, } = useIndexResourceState(recommendedApps);

    useEffect(() => {
		if(loaderData && loaderData.target == "recommendedAppsList" && loaderData.message == "Success") {
			if(initialRecommendedApps.length > 0) {
                // As the Open tab is opened by default, we have to set opened recommendedApp list for this tab
                setRecommendedApps(categorizedRecommendedApps(0));
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
        // After tab change, set appropriate recommendedApp list for that specific tab
        setRecommendedApps(categorizedRecommendedApps(index));
    };

    const categorizedRecommendedApps = (index) => {
        if(index == 0) {
            return initialRecommendedApps;
        }
        else if(index == 1) {
            return initialRecommendedApps.filter(recommendedApp => recommendedApp.status == "ACTIVE");
        }
        else if(index == 2) {
            return initialRecommendedApps.filter(recommendedApp => recommendedApp.status == "INACTIVE");
        }
        return [];
    }

    const promotedBulkActions = [];
    if(agentRole == "ADMIN" || agentPermissions.includes("RAPP_EDT")) {
        promotedBulkActions.push({
            content: "Activate",
            onAction: () => { bulkAction('activate') },
        },
        {
            content: "Deactivate",
            onAction: () => { bulkAction('deactivate') },
        });
    }
    if(agentRole == "ADMIN" || agentPermissions.includes("RAPP_DLT")) {
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
        const selectedObjectIds = getSelectedObjectsId(selectedResources, recommendedApps);
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
                            {(agentRole == "ADMIN" || agentPermissions.includes("RAPP_CRT")) && (
                                <Button
                                    accessibilityLabel="Create recommendedApp"
                                    variant="primary"
                                    size="large"
                                    icon={PlusIcon}
                                    url="/supports/recommended-apps/new"
                                >Create recommended app</Button>
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
                                    selectable={(agentRole == "ADMIN" || agentPermissions.includes("RAPP_EDT") || agentPermissions.includes("RAPP_DLT")) ? true : false}
                                    promotedBulkActions={promotedBulkActions}
                                    resourceName={resourceName}
                                    itemCount={recommendedApps.length}
                                    onSelectionChange={handleSelectionChange}
                                    onNavigation={() => { }}
                                    selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
                                    headings={[
                                        { title: "Serial" },
                                        { title: "name" },
                                        { title: "validity" },
                                        { title: "Status" },
                                        { title: "Updated at" }
                                    ]}
                                >
                                    {recommendedApps.map((recommendedApp, index) => (
                                        <IndexTable.Row
                                            id={recommendedApp.id}
                                            key={recommendedApp.id}
                                            position={index}
                                            selected={selectedResources.includes(recommendedApp.id)}
                                        >
                                            <IndexTable.Cell>{recommendedApp.serial}</IndexTable.Cell>
                                            {(agentRole == "ADMIN" || agentPermissions.includes("RAPP_EDT")) ? (
                                                <IndexTable.Cell>
                                                    <Button url={`/supports/recommended-apps/${recommendedApp.id}`} variant="plain" size="large">
                                                        {recommendedApp.name}
                                                    </Button>
                                                </IndexTable.Cell>
                                            ) : (
                                                <IndexTable.Cell>
                                                    <Text variant="headingSm" as="h6">{recommendedApp.name}</Text>
                                                </IndexTable.Cell>
                                            )}
                                            <IndexTable.Cell>
                                                <Text variant="headingSm" as="h6">{recommendedApp.validity ?  formatDate(recommendedApp.validity): "-" }</Text>
                                            </IndexTable.Cell>
                                            <IndexTable.Cell>
                                                {recommendedApp.status == "ACTIVE" && (
                                                    <Badge tone="success">{"Active"}</Badge>
                                                )}
                                                {recommendedApp.status == "INACTIVE" && (
                                                    <Badge tone="attention">{"Inactive"}</Badge>
                                                )}
                                            </IndexTable.Cell>
                                            <IndexTable.Cell>{ recommendedApp.updatedAt ? formatDate(recommendedApp.updatedAt) : "-" }</IndexTable.Cell>
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
