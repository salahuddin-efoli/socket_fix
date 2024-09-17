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
    if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("FAQ_LST")) {
        return redirect("/supports/faqs");
    }
    // Else proceed to regular operations

    const faqs = await prisma.faqs.findMany({
        select: {
            id: true,
            serial: true,
            title: true,
            description: true,
            status: true,
            updatedAt: true,
        },
        orderBy: {
            serial: "asc"
        }
    });

    return {
        target: "faqsList",
        message: "Success",
        data: {
            agentRole: currentAgent.role,
            agentPermissions: currentAgent.permissions,
            faqs: faqs || []
        }
    }
};

export const action = async ({ request }) => {
    const formdata = await request.formData();
    const target = formdata.get("target");
    const selectedObjectIds = JSON.parse(formdata.get("selectedObjectIds"));

    try {
        const currentAgent = await getUserAccess(request, authenticator, prisma);
        if (target == "delete" && (currentAgent.role == "ADMIN" || currentAgent.permissions.includes("FAQ_DLT"))) {
            for (let index = 0; index < selectedObjectIds.length; index++) {
                await prisma.faqs.delete({
                    where: {
                        id: selectedObjectIds[index] || 0,
                    }
                });
            }
        }
        else if ((target == "activate" || target == "deactivate") && (currentAgent.role == "ADMIN" || currentAgent.permissions.includes("FAQ_EDT"))) {
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
                await prisma.faqs.update({
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

export default function FaqList() {
    const loaderData = useLoaderData();
    const actionData = useActionData();
    const submit = useSubmit();
    const { t } = useTranslation();

    const [pageLoader, setPageLoader] = useState(true);
    const [selectedTab, setSelectedTab] = useState(0);

    const agentRole = loaderData?.data?.agentRole;
    const agentPermissions = loaderData?.data?.agentPermissions;
    const initialFaqs = [ ...loaderData.data.faqs ];
    const [faqs, setFaqs] = useState([]);

    const resourceName = {
        singular: 'faq',
        plural: 'faqs',
    };
    const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection, } = useIndexResourceState(faqs);

    useEffect(() => {
		if(loaderData && loaderData.target == "faqsList" && loaderData.message == "Success") {
			if(initialFaqs.length > 0) {
                // As the Open tab is opened by default, we have to set opened faq list for this tab
                setFaqs(categorizedFaqs(0));
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
        // After tab change, set appropriate faq list for that specific tab
        setFaqs(categorizedFaqs(index));
    };

    const categorizedFaqs = (index) => {
        if(index == 0) {
            return initialFaqs;
        }
        else if(index == 1) {
            return initialFaqs.filter(faq => faq.status == "ACTIVE");
        }
        else if(index == 2) {
            return initialFaqs.filter(faq => faq.status == "INACTIVE");
        }
        return [];
    }

    const promotedBulkActions = [];
    if(agentRole == "ADMIN" || agentPermissions.includes("FAQ_EDT")) {
        promotedBulkActions.push({
            content: "Activate",
            onAction: () => { bulkAction('activate') },
        },
        {
            content: "Deactivate",
            onAction: () => { bulkAction('deactivate') },
        });
    }
    if(agentRole == "ADMIN" || agentPermissions.includes("FAQ_DLT")) {
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
        const selectedObjectIds = getSelectedObjectsId(selectedResources, faqs);
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
                            {(agentRole == "ADMIN" || agentPermissions.includes("FAQ_CRT")) && (
                                <Button
                                    accessibilityLabel="Create FAQ"
                                    variant="primary"
                                    size="large"
                                    icon={PlusIcon}
                                    url="/supports/faqs/new"
                                >Create FAQ</Button>
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
                                    selectable={(agentRole == "ADMIN" || agentPermissions.includes("FAQ_EDT") || agentPermissions.includes("FAQ_DLT")) ? true : false}
                                    promotedBulkActions={promotedBulkActions}
                                    resourceName={resourceName}
                                    itemCount={faqs.length}
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
                                    {faqs.map((faq, index) => (
                                        <IndexTable.Row
                                            id={faq.id}
                                            key={faq.id}
                                            position={index}
                                            selected={selectedResources.includes(faq.id)}
                                        >
                                            <IndexTable.Cell>{faq.serial}</IndexTable.Cell>
                                            {(agentRole == "ADMIN" || agentPermissions.includes("FAQ_EDT")) ? (
                                                <IndexTable.Cell>
                                                    <Button url={`/supports/faqs/${faq.id}`} variant="plain" size="large">
                                                        {faq.title}
                                                    </Button>
                                                </IndexTable.Cell>
                                            ) : (
                                                <IndexTable.Cell>
                                                    <Text variant="headingSm" as="h6">{faq.title}</Text>
                                                </IndexTable.Cell>
                                            )}
                                            <IndexTable.Cell>
                                                {faq.status == "ACTIVE" && (
                                                    <Badge tone="success">{"Active"}</Badge>
                                                )}
                                                {faq.status == "INACTIVE" && (
                                                    <Badge tone="attention">{"Inactive"}</Badge>
                                                )}
                                            </IndexTable.Cell>
                                            <IndexTable.Cell>{ faq.updatedAt ? formatDate(faq.updatedAt) : "-" }</IndexTable.Cell>
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
