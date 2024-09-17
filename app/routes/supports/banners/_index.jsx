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
    if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("BNNR_LST")) {
        return redirect("/supports/banners");
    }
    // Else proceed to regular operations

    const banners = await prisma.dashboardBanners.findMany({
        select: {
            id: true,
            serial: true,
            title: true,
            description: true,
            tone: true,
            validity: true,
            status: true,
            updatedAt: true,
        },
        orderBy: {
            serial: "asc"
        }
    });

    return {
        target: "bannersList",
        message: "Success",
        data: {
            agentRole: currentAgent.role,
            agentPermissions: currentAgent.permissions,
            banners: banners || []
        }
    }
};

export const action = async ({ request }) => {
    const formdata = await request.formData();
    const target = formdata.get("target");
    const selectedObjectIds = JSON.parse(formdata.get("selectedObjectIds"));

    try {
        const currentAgent = await getUserAccess(request, authenticator, prisma);
        if (target == "delete" && (currentAgent.role == "ADMIN" || currentAgent.permissions.includes("BNNR_DLT"))) {
            for (let index = 0; index < selectedObjectIds.length; index++) {
                await prisma.dashboardBanners.delete({
                    where: {
                        id: selectedObjectIds[index] || 0,
                    }
                });
            }
        }
        else if ((target == "activate" || target == "deactivate") && (currentAgent.role == "ADMIN" || currentAgent.permissions.includes("BNNR_EDT"))) {
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
                await prisma.dashboardBanners.update({
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
    const initialBanners = [ ...loaderData.data.banners ];
    const [banners, setBanners] = useState([]);

    const resourceName = {
        singular: 'Banner',
        plural: 'Banners',
    };
    const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection, } = useIndexResourceState(banners);

    useEffect(() => {
		if(loaderData && loaderData.target == "bannersList" && loaderData.message == "Success") {
			if(initialBanners.length > 0) {
                // As the Open tab is opened by default, we have to set opened Banner list for this tab
                setBanners(categorizedBanners(0));
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
        // After tab change, set appropriate Banner list for that specific tab
        setBanners(categorizedBanners(index));
    };

    const categorizedBanners = (index) => {
        if(index == 0) {
            return initialBanners;
        }
        else if(index == 1) {
            return initialBanners.filter(Banner => Banner.status == "ACTIVE");
        }
        else if(index == 2) {
            return initialBanners.filter(Banner => Banner.status == "INACTIVE");
        }
        return [];
    }

    const promotedBulkActions = [];
    if(agentRole == "ADMIN" || agentPermissions.includes("BNNR_EDT")) {
        promotedBulkActions.push({
            content: "Activate",
            onAction: () => { bulkAction('activate') },
        },
        {
            content: "Deactivate",
            onAction: () => { bulkAction('deactivate') },
        });
    }
    if(agentRole == "ADMIN" || agentPermissions.includes("BNNR_DLT")) {
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
        const selectedObjectIds = getSelectedObjectsId(selectedResources, banners);
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
                            {(agentRole == "ADMIN" || agentPermissions.includes("BNNR_CRT")) && (
                                <Button
                                    accessibilityLabel="Create Banner"
                                    variant="primary"
                                    size="large"
                                    icon={PlusIcon}
                                    url="/supports/banners/new"
                                >Create Banner</Button>
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
                                    selectable={(agentRole == "ADMIN" || agentPermissions.includes("BNNR_EDT") || agentPermissions.includes("BNNR_DLT")) ? true : false}
                                    promotedBulkActions={promotedBulkActions}
                                    resourceName={resourceName}
                                    itemCount={banners.length}
                                    onSelectionChange={handleSelectionChange}
                                    onNavigation={() => { }}
                                    selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
                                    headings={[
                                        { title: "Serial" },
                                        { title: "Title" },
                                        { title: "Status" },
                                        { title: "Updated at" }
                                    ]}
                                >
                                    {banners.map((banner, index) => (
                                        <IndexTable.Row
                                            id={banner.id}
                                            key={banner.id}
                                            position={index}
                                            selected={selectedResources.includes(banner.id)}
                                        >
                                            <IndexTable.Cell>{banner.serial}</IndexTable.Cell>
                                            {(agentRole == "ADMIN" || agentPermissions.includes("BNNR_EDT")) ? (
                                                <IndexTable.Cell>
                                                    <Button url={`/supports/banners/${banner.id}`} variant="plain" size="large">
                                                        {banner.title}
                                                    </Button>
                                                </IndexTable.Cell>
                                            ) : (
                                                <IndexTable.Cell>
                                                    <Text variant="headingSm" as="h6">{banner.title}</Text>
                                                </IndexTable.Cell>
                                            )}
                                            <IndexTable.Cell>
                                                {banner.status == "ACTIVE" && (
                                                    <Badge tone="success">{"Active"}</Badge>
                                                )}
                                                {banner.status == "INACTIVE" && (
                                                    <Badge tone="attention">{"Inactive"}</Badge>
                                                )}
                                            </IndexTable.Cell>
                                            <IndexTable.Cell>{ banner.updatedAt ? formatDate(banner.updatedAt) : "-" }</IndexTable.Cell>
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
