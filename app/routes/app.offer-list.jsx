import { Box, Bleed, BlockStack, Card, IndexFilters, IndexTable, Page, Text, useIndexResourceState, useSetIndexFiltersMode, Badge, InlineStack, Tooltip, Icon } from "@shopify/polaris";
import { QuestionCircleIcon } from "@shopify/polaris-icons";
import { createActivityLog, getFormattedDateTime } from '../libs/helpers';
import { useLoaderData, useSubmit, useActionData, Link, useNavigate, useSearchParams } from "@remix-run/react";
import { useCallback, useEffect, useState } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useTranslation } from "react-i18next";

export const loader = async ({ request }) => {
	const { admin } = await authenticate.admin(request);
	const shopInfoResponse = await admin.graphql(`query mainQuery { shop { myshopifyDomain timezoneOffsetMinutes } }`);
	const shopInfoResponseJson = await shopInfoResponse.json();
    const myshopifyDomain = shopInfoResponseJson.data.shop.myshopifyDomain;
    const timezoneOffsetMinutes = shopInfoResponseJson.data.shop.timezoneOffsetMinutes;

	try {
		const discounts = await prisma.discounts.findMany({
			select: {
				id: true,
				title: true,
				type: true,
				startsAt: true,
				endsAt: true,
				status: true,
				shopId: true,
				discountId: true,
				createdAt: true,
				updatedAt: true,
			},
			where: {
				shop: {
					myshopifyDomain: myshopifyDomain,
				},
				deletedAt: null
			},
			orderBy: {
				createdAt: "desc",
			},
		});

        const idsToRemove = [];
        // Loop through the discounts to deleted non-existing discounts
        for (let index = 0; index < discounts.length; index++) {
            // First check if this discount exists in Shopify 
            const discountResponse = await admin.graphql(`#graphql
            query getAutomaticDiscount($id: ID!) {
                discountNode(id: $id) { id }
            }`, {
                variables: {
                    id: discounts[index].discountId,
                }
            });
            const discountResponseJson = await discountResponse.json();
            // If this discount is missing in Shopify then deleted it
            if(discountResponseJson.data.discountNode == null) {
                // Now update the deleted at value of this discount by ID to mark it as deleted
                await prisma.discounts.update({
                    where: {
                        discountId: discounts[index].discountId,
                    },
                    data: {
                        deletedAt: new Date().toISOString(),
                    },
                });
                idsToRemove.push(discounts[index].id);
            }
        }
        // If any discount was deleted, then remove it from the list
        const filteredDiscounts = discounts.filter(discount => !idsToRemove.includes(discount.id));
		return {
			target: "get-discounts",
			message: "Success",
			data: filteredDiscounts || [],
            timezoneOffsetMinutes: timezoneOffsetMinutes,
			functionIds: {
				quantityDiscountFID: import.meta.env.VITE_QUANTITY_DISCOUNT_FUNCTION_ID,
                priceDiscountFID: import.meta.env.VITE_PRICE_DISCOUNT_FUNCTION_ID,
			},
		};
	} catch (error) {
		createActivityLog({type: "error", shop: myshopifyDomain, subject: "Discount list", body: error });
		return {
			target: "get-discounts",
			message: "Error",
			data: {}
		};
	}
};
export const action = async ({ params, request }) => {
    const { admin } = await authenticate.admin(request);
	const shopInfoResponse = await admin.graphql(`query mainQuery { shop { myshopifyDomain } }`);
	const shopInfoResponseJson = await shopInfoResponse.json();
    const myshopifyDomain = shopInfoResponseJson.data.shop.myshopifyDomain;

	const formdata = await request.formData();
	const target = formdata.get("target");
	const selectedDiscoutIds = JSON.parse(formdata.get("selectedDiscoutIds"));
	const affectedDiscounts = [];
    
	try {
		// Setting the appropriate graphQl query for action depending on target
		if (target == "delete-discount") {
			//mutation starts
			const graphqlQuery = `#graphql
            mutation discountAutomaticDelete($id: ID!) {
                discountAutomaticDelete(id: $id) {
                    deletedAutomaticDiscountId
                    userErrors {
                        field
                        code
                        message
                    }
                }
            }`;
			
			for (let index = 0; index < selectedDiscoutIds.length; index++) {
				const queryParams = {
					variables: {
						id: selectedDiscoutIds[index],
					},
				};
				const response = await admin.graphql(graphqlQuery, queryParams);
				const responseJson = await response.json();
				if (responseJson?.data?.discountAutomaticDelete?.deletedAutomaticDiscountId) {
					const discountId = responseJson.data.discountAutomaticDelete.deletedAutomaticDiscountId || "";

					// Now update the deleted at value of this discount by ID
					await prisma.discounts.update({
						where: {
							discountId: discountId,
						},
						data: {
							deletedAt: new Date().toISOString(),
						},
					});

					affectedDiscounts.push({
						id: discountId,
					});
					createActivityLog({type: "success", shop: myshopifyDomain, subject: "Delete discount", body: responseJson, query: graphqlQuery, variables: queryParams});
				}
				else {
					createActivityLog({type: "error", shop: myshopifyDomain, subject: "Delete discount", body: responseJson, query: graphqlQuery, variables: queryParams});
				}
			}
		}
		else if (target == "activate-discount") {
			//mutation starts
			const graphqlQuery = `#graphql
            mutation discountAutomaticActivate($id: ID!) {
                discountAutomaticActivate(id: $id) {
                    automaticDiscountNode{
                        automaticDiscount{
                            ... on DiscountAutomaticApp{
                                discountId
                                status
								startsAt
								endsAt
                            }
                        }
                    }
                    userErrors {
                        field
                        code
                        message
                    }
                }
            }`;

			for (let index = 0; index < selectedDiscoutIds.length; index++) {
				const queryParams = {
					variables: {
						id: selectedDiscoutIds[index],
					},
				};
				const response = await admin.graphql(graphqlQuery, queryParams);
				const responseJson = await response.json();
				if (responseJson?.data?.discountAutomaticActivate?.automaticDiscountNode?.automaticDiscount) {
					const discountId = responseJson.data.discountAutomaticActivate.automaticDiscountNode.automaticDiscount.discountId || "";
					const status = responseJson.data.discountAutomaticActivate.automaticDiscountNode.automaticDiscount.status || "";
					const startsAt = responseJson.data.discountAutomaticActivate.automaticDiscountNode.automaticDiscount.startsAt || "";
					const endsAt = responseJson.data.discountAutomaticActivate.automaticDiscountNode.automaticDiscount.endsAt || null;

					// Now update the deleted at value of this discount by ID
					let updatedDiscount = await prisma.discounts.update({
						where: {
							discountId: discountId,
						},
						data: {
							startsAt: startsAt,
							endsAt: endsAt,
							status: status,
							updatedAt: new Date().toISOString(),
							deletedAt: null,
						},
					});

					affectedDiscounts.push({
						id: discountId,
						startsAt: startsAt,
						endsAt: endsAt,
						status: status,
						updatedAt: updatedDiscount.updatedAt,
					});
					createActivityLog({type: "success", shop: myshopifyDomain, subject: "Activate discount", body: responseJson, query: graphqlQuery, variables: queryParams});
				}
				else {
					createActivityLog({type: "error", shop: myshopifyDomain, subject: "Activate discount", body: responseJson, query: graphqlQuery, variables: queryParams});
				}
			}
		}
		else if (target == "deactivate-discount") {
			//mutation starts
			const graphqlQuery = `#graphql
            mutation discountAutomaticDeactivate($id: ID!) {
                discountAutomaticDeactivate(id: $id) {
                    automaticDiscountNode{
                        automaticDiscount{
                            ... on DiscountAutomaticApp{
                                discountId
                                status
								startsAt
								endsAt
                            }
                        }
                    }
                    userErrors {
                        field
                        code
                        message
                    }
                }
            }`;

			for (let index = 0; index < selectedDiscoutIds.length; index++) {
				const queryParams = {
					variables: {
						id: selectedDiscoutIds[index],
					},
				};
				const response = await admin.graphql(graphqlQuery, queryParams);
				const responseJson = await response.json();
				if (responseJson?.data?.discountAutomaticDeactivate?.automaticDiscountNode?.automaticDiscount) {
					const discountId = responseJson.data.discountAutomaticDeactivate.automaticDiscountNode.automaticDiscount.discountId || "";
					const status = responseJson.data.discountAutomaticDeactivate.automaticDiscountNode.automaticDiscount.status || "";
					const startsAt = responseJson.data.discountAutomaticDeactivate.automaticDiscountNode.automaticDiscount.startsAt || "";
					const endsAt = responseJson.data.discountAutomaticDeactivate.automaticDiscountNode.automaticDiscount.endsAt || null;

					// Now update the deleted at value of this discount by ID
					let updatedDiscount = await prisma.discounts.update({
						where: {
							discountId: discountId,
						},
						data: {
							startsAt: startsAt,
							endsAt: endsAt,
							status: status,
							updatedAt: new Date().toISOString(),
							deletedAt: null,
						},
					});

					affectedDiscounts.push({
						id: discountId,
						startsAt: startsAt,
						endsAt: endsAt,
						status: status,
						updatedAt: updatedDiscount.updatedAt,
					});
					createActivityLog({type: "success", shop: myshopifyDomain, subject: "Deactivate discount", body: responseJson, query: graphqlQuery, variables: queryParams});
				}
				else {
					createActivityLog({type: "error", shop: myshopifyDomain, subject: "Deactivate discount", body: responseJson, query: graphqlQuery, variables: queryParams});
				}
			}
		}
		const discounts = await prisma.discounts.findMany({
			select: {
				id: true,
				title: true,
				type: true,
				startsAt: true,
				endsAt: true,
				status: true,
				shopId: true,
				discountId: true,
				createdAt: true,
				updatedAt: true,
			},
			where: {
				shop: {
					myshopifyDomain: myshopifyDomain,
				},
				deletedAt: null,
			},
		});
		return {
			target: target,
			message: "Success",
			data: discounts,
			affectedDiscounts: affectedDiscounts,
		};
	} catch (err) {
		createActivityLog({type: "error", shop: myshopifyDomain, subject: `Discount action: ${target}`, body: err });
		return {
			target: "error",
			message: "something_went_wrong",
			data: err,
		};
	}
};
// Default export for showing the created discounts.
export default function OfferList() {
    const { t } = useTranslation();
	const actionData = useActionData() || {};
	const loaderData = useLoaderData();
    const [searchParams, setSearchParams] = useSearchParams();
	const submit = useSubmit();
    const navigate = useNavigate();

    const timezoneOffsetMinutes = loaderData.timezoneOffsetMinutes;

	const [pageLoader, setPageLoader] = useState(true);
	const [quantityDiscountFunctionId, setQuantityDiscountFunctionId] = useState("");
	const [priceDiscountFunctionId, setPriceDiscountFunctionId] = useState("");

    const [initialDiscounts, setInitialDiscounts] = useState([]);
	const [discounts, setDiscounts] = useState([]);
    
    const maxActiveDiscounts = 5;
	const [activeDiscounts, setActiveDiscounts] = useState(0);

	useEffect(() => {
		if(loaderData && loaderData.target == "get-discounts" && loaderData.message == "Success") {
			if(loaderData.data && loaderData.data.length > 0) {
				setInitialDiscounts([ ...loaderData.data ]);
			}
			if (loaderData.functionIds) {
				if (loaderData.functionIds.quantityDiscountFID) {
					setQuantityDiscountFunctionId(
						loaderData.functionIds.quantityDiscountFID || ""
					);
				}
				if (loaderData.functionIds.priceDiscountFID) {
					setPriceDiscountFunctionId(
						loaderData.functionIds.priceDiscountFID || ""
					);
				}
			}
            if(pageLoader) {
                setPageLoader(false);
            }
		}
	}, []);
    
	const resourceName = {
		singular: "discount",
		plural: "discounts",
	};
	// Table Props Data and building the table rows and cells for the table component.
	const {	selectedResources, allResourcesSelected, handleSelectionChange, clearSelection, } = useIndexResourceState(discounts);

	// Table Filter Section starts here ======================================================================

	const { mode, setMode } = useSetIndexFiltersMode("DEFAULT");

	// ============= SECTION START Handling Sort =============
	// The sorting optons that are being offered.
	const sortOptions = [
		{ label: t("created_at_date"), value: "createdAt asc", directionLabel: t("earliest") },
		{ label: t("created_at_date"), value: "createdAt desc", directionLabel: t("latest")},
		{ label: t("starts_at"), value: "startsAt asc", directionLabel: t("earliest") },
		{ label: t("starts_at"), value: "startsAt desc", directionLabel: t("latest")},
		{ label: t("ends_at"), value: "endsAt asc", directionLabel: t("earliest") },
		{ label: t("ends_at"), value: "endsAt desc", directionLabel: t("latest")},
		{ label: t("title"), value: "title asc", directionLabel: t("a_z") },
		{ label: t("title"), value: "title desc", directionLabel: t("z_a") },
		{ label: t("updated_at_date"), value: "updatedAt asc", directionLabel: t("earliest") },
		{ label: t("updated_at_date"), value: "updatedAt desc", directionLabel: t("latest")},
	];

	// Used to handle the selected sort key.
	const [sortKey, setSortKey] = useState("createdAt");

	// Used to handle the selected sort direction.
	const [sortDirection, setSortDirection] = useState("desc");

	// Used to handle the selected sort option which is build using the key and direction.
	const [sortSelected, setSortSelected] = useState([`${sortKey} ${sortDirection}`]);

	// Used  to set the sort option based on the changes of sort key and direction.
	useEffect(() => {
		setSortSelected([`${sortKey} ${sortDirection}`]); // setting the sort key and direction
	}, [sortKey, sortDirection]);

	// Handling the sort key change.
	function handleSortKeyChange(val) {
		setSortKey(val); // Setting the sort key.
		setSortDirection("asc"); // To select ascending by default when the key changes.
	}

	// Handling the direction of the sort.
	function handleSortDirectionChange(val) {
		setSortDirection(val); // Setting the sort direction.
	}

	// Used to handle the sorting of the data.
	useEffect(() => {
		// getting the selected sort key and direction
		const sortSelectedArr = sortSelected[0].split(" ");
		const [sortKey, direction] = sortSelectedArr;
		// Function to sort products by title
		const sortByTitle = (a, b) => {
			const titleA = a.title.toUpperCase();
			const titleB = b.title.toUpperCase();
			return direction === "asc" ? titleA.localeCompare(titleB) : titleB.localeCompare(titleA);
		};
	
		// Function to sort items by createdAt or updatedAt
		const sortByDate = (field) => (a, b) => {
			const dateA = new Date(a[field]);
			const dateB = new Date(b[field]);
			return direction === "asc" ? dateA - dateB : dateB - dateA;
		};
	
		// Sort based on sortKey
		let sortedDiscounts = [...discounts];
		switch (sortKey) {
			case "updatedAt":
				sortedDiscounts = sortedDiscounts.sort(sortByDate("updatedAt"));
				break;
			case "createdAt":
				sortedDiscounts = sortedDiscounts.sort(sortByDate("createdAt"));
				break;
			case "startsAt":
				sortedDiscounts = sortedDiscounts.sort(sortByDate("startsAt"));
				break;
			case "endsAt":
				sortedDiscounts = sortedDiscounts.sort(sortByDate("endsAt"));
				break;
			case "title":
				sortedDiscounts = sortedDiscounts.sort(sortByTitle);
				break;
			default:
				sortedDiscounts = sortedDiscounts;
				break;
		}
	
		// Update state with sortedDiscounts
		setDiscounts([...sortedDiscounts]);
	}, [sortSelected]);
	// ============= SECTION END Handling Sort =============

	// ============= SECTION START Handling Tabs  =============
	// To keep track of the seleted tabs index(from itemStrings) which is used by the tabs selected prop.
	const [selectedTab, setSelectedTab] = useState(searchParams.get("at") ? parseInt(searchParams.get("at")) : 0);

	// The tab strings is used to build the tabs.
	const [itemStrings, setItemStrings] = useState([t("all"), t("quantity_discount"), t("price_discount")]);

	// Building the tabs from the itemStrings array.
	const tabs = itemStrings.map((item, index) => ({
		id: `${item}-${index}`,
		content: item,
		isLocked: index === 0,
		accessibilityLabel: t("all"),
	}));

	// Managing the table output based on the tab selection.
	function handleTabSelection(val) {
		// Setting the new discounts list based on the selection.
		if (itemStrings[val] == t("all")) {
			setDiscounts([...initialDiscounts]);
		} else if (itemStrings[val] == t("quantity_discount")) {
			// Finding the active discounts and setting the discounts list to active discounts
			const filteredDiscounts = initialDiscounts.filter((discount) => discount.type === "QUANTITY_DISCOUNT");
			setDiscounts([...filteredDiscounts]);
		} else if (itemStrings[val] == t("price_discount")) {
			// Finding the draft discounts and setting the discounts list to draft discounts
			const filteredDiscounts = initialDiscounts.filter((discount) => discount.type === "PRICE_DISCOUNT");
			setDiscounts([...filteredDiscounts]);
		}

		// Setting the selectedTab to the selected index.
		setSelectedTab(val);
		setSortSelected([`${sortKey} ${sortDirection}`]);
	}
	// SECTION END Handling Tabs  =============

	// SECTION START Handling Query  =============
	// Tracking the query state
	const [queryValue, setQueryValue] = useState("");

	// Used to manage the query filters state.
	const handleFiltersQueryChange = useCallback((value) => {
		setQueryValue(value);
	}, []);

	// Used to hanlde the cancel button press in the query seciton.
	const onHandleCancel = () => {
		setQueryValue("");
	};

	useEffect(() => {
		if (selectedTab == 0) {
            const filteredDiscounts = initialDiscounts.filter((discount) => isSubstring(queryValue, discount.title));
            setDiscounts([...filteredDiscounts]);
        } else if (selectedTab == 1) {
            // Finding the active discounts and setting the discounts list to active discounts
            const filteredDiscounts = initialDiscounts.filter((discount) => discount.type === "QUANTITY_DISCOUNT" && isSubstring(queryValue, discount.title));
            setDiscounts([...filteredDiscounts]);
        } else if (selectedTab == 2) {
            // Finding the draft discounts and setting the discounts list to draft discounts
            const filteredDiscounts = initialDiscounts.filter((discount) => discount.type === "PRICE_DISCOUNT" && isSubstring(queryValue, discount.title));
            setDiscounts([...filteredDiscounts]);
        }
	}, [queryValue]);

	const [modalOpen, setModalOpen] = useState(false);

	const openActiveDiscountsModal = () => {
		setModalOpen(true);
		shopify.modal.show("discounts-active-modal");
	};
	const closeActiveDiscountsModal = () => {
		setModalOpen(false);
		shopify.modal.hide("discounts-active-modal");
	};
	const openDeactiveDiscountsModal = () => {
		setModalOpen(true);
		shopify.modal.show("discounts-deactive-modal");
	};
	const closeDeactiveDiscountsModal = () => {
		setModalOpen(false);
		shopify.modal.hide("discounts-deactive-modal");
	};
	const openDeleteModal = () => {
		setModalOpen(true);
		shopify.modal.show("delete-modal");
	};
	//to close the clicking the modal close button
	const closeDeleteModal = () => {
		setModalOpen(false);
		shopify.modal.hide("delete-modal");
	};
	// SECTION END Handling Query  =============

    const [promotedBulkActions, setPromotedBulkActions] = useState([]);
    useEffect(() => {
        /**
         * * Dynamically show bulk actions
         * TODO: First get all the selected discounts from total discounts
         * TODO: Then, count the number of status from each selected discounts
         * TODO: Here, things to consider that,
         * TODO:    1. Delete action will always be shown
         * TODO:    2. Active action will always be shown when all selected discounts are expired or scheduled
         * TODO:    3. Deactive action will always be shown when all selected discounts are active or scheduled
         * TODO:    4. Active Deactive both actions will always be shown when all selected discounts are scheduled
         */
        const filteredArr = discounts.filter(item => selectedResources.includes(item.id));
        const statusCounts = filteredArr.reduce((acc, discount) => {
            acc[discount.status] = (acc[discount.status] || 0) + 1;
            return acc;
        }, {});
        const bulkActions = [];
        let showActive = false;
        let showDeactive = false;
        let selectedNonActiveDiscounts = 0;
        if(statusCounts.SCHEDULED && statusCounts.SCHEDULED > 0) {
            showActive = true;
            showDeactive = true;
            selectedNonActiveDiscounts += statusCounts.SCHEDULED;
        }
        if(statusCounts.EXPIRED && statusCounts.EXPIRED > 0) {
            showActive = true;
            selectedNonActiveDiscounts += statusCounts.EXPIRED;
        }
        if(statusCounts.ACTIVE && statusCounts.ACTIVE > 0) {
            showDeactive = true;
        }

        if(showActive) {
            bulkActions.push({
                content: t("active_discounts"),
                onAction: () => {
                    openActiveDiscountsModal();
                },
                // We are disabling this when the total number of active discounts going to cross the shopify limit (5) of maximum active discounts at a time
                disabled: (activeDiscounts + selectedNonActiveDiscounts) > maxActiveDiscounts
            });
        }
        if(showDeactive) {
            bulkActions.push({
                content: t("deactive_discounts"),
                onAction: () => {
                    openDeactiveDiscountsModal();
                },
            });
        }
        bulkActions.push({
            content: t("delete_discounts"),
            onAction: () => {
                openDeleteModal();
            },
        });
        setPromotedBulkActions([...bulkActions]);
	}, [selectedResources]);

	//get discountId array from selected row cells
	function discountIdsFromIds(currentArr, mainArr) {
		const filteredArr = mainArr
			.filter((obj) => currentArr.includes(obj.id))
			.map((obj) => obj.discountId);
		return filteredArr;
	}

	const deleteDiscount = () => {
		setPageLoader(true);
		closeDeleteModal();
		const selectedDiscoutIds = discountIdsFromIds(selectedResources, discounts);
		submit({
			target: "delete-discount",
			selectedDiscoutIds: JSON.stringify(selectedDiscoutIds),
		}, { method: "POST" });
	};

	const activateDiscount = () => {
		setPageLoader(true);
		closeActiveDiscountsModal();
		const selectedDiscoutIds = discountIdsFromIds(selectedResources, discounts);
		submit({
			target: "activate-discount",
			selectedDiscoutIds: JSON.stringify(selectedDiscoutIds)
		}, { method: "POST" });
	};

	const deactivateDiscount = () => {
		setPageLoader(true);
		closeDeactiveDiscountsModal();
		const selectedDiscoutIds = discountIdsFromIds(selectedResources, discounts);
		submit({
			target: "deactivate-discount",
			selectedDiscoutIds: JSON.stringify(selectedDiscoutIds)
		}, { method: "POST" });
	};

	const changeDiscountStatus = (affectedDiscounts, allDiscounts) => {
		let updatedDicountList = [...allDiscounts];
		for (let index = 0; index < updatedDicountList.length; index++) {
			let targetDiscount = affectedDiscounts.find(d => d.id == updatedDicountList[index].discountId);
			if(targetDiscount) {
				updatedDicountList[index].startsAt = targetDiscount.startsAt;
				updatedDicountList[index].endsAt = targetDiscount.endsAt;
				updatedDicountList[index].status = targetDiscount.status;
				updatedDicountList[index].updatedAt = targetDiscount.updatedAt;
			}
		}
		return updatedDicountList;
	}

	const removeDeletedDiscounts = (affectedDiscounts, allDiscounts) => {
		let updatedDicountList = [...allDiscounts];
		for (let i = 0; i < affectedDiscounts.length; i++) {
			for (let index = 0; index < updatedDicountList.length; index++) {
				if (updatedDicountList[index].discountId == affectedDiscounts[i].id) {
					updatedDicountList.splice(index, 1);
					break;
				}
			}
		}
		return updatedDicountList;
	}

	if (actionData) {
		if (actionData.target == "error") {
			shopify.toast.show(t(actionData.message), { isError: true });
		}
		else if(actionData.message == "Success") {
			if (pageLoader == true) {
				let updatedDicountList = [];
				let message = t("operation_successful");
				if (actionData.target == "delete-discount") {
					message = t("discounts_action_successfully", { action: t("deleted") });
					updatedDicountList = removeDeletedDiscounts(actionData.affectedDiscounts, actionData.data);
				}
				else if (actionData.target == "activate-discount" || actionData.target == "deactivate-discount") { 
                    message = t("discounts_action_successfully", { action: t(actionData.target == "activate-discount" ? "activated" : "deactivated") });
					updatedDicountList = changeDiscountStatus(actionData.affectedDiscounts, actionData.data);
				}
				setDiscounts([...updatedDicountList]);
				setInitialDiscounts([...updatedDicountList]);
				clearSelection();
				setPageLoader(false);
				shopify.toast.show(message);
			}
		}
	}

	useEffect(() => {
		actionData.target = "";
		actionData.message = "";
		actionData.data = [];
		actionData.affectedDiscounts = [];
        setActiveDiscounts(initialDiscounts.filter(d => d.status === "ACTIVE").length || 0);
		handleTabSelection(selectedTab);
	}, [initialDiscounts]);
  
	return (
		<BlockStack>
			<Bleed>
				<Page fullWidth>
                    <Card>
                        <IndexFilters
                            sortOptions={sortOptions} // The list of sorting options.
                            sortSelected={sortSelected} // The selected sorting option.
                            // onSort={handleSort} // Setter function to set the selected option.
                            onSortKeyChange={handleSortKeyChange} //  To handle the sort key change.
                            onSortDirectionChange={handleSortDirectionChange} // To handle the direction of the sort.
                            tabs={tabs} // Used to show the list of the tabs.
                            selected={selectedTab} // Used to determine when tabs should be selected.
                            onSelect={handleTabSelection} // Used to handle new tab selection events.
                            canCreateNewView={false} // Used to create a new tab view.
                            queryValue={queryValue} // Used to set the query value.
                            queryPlaceholder="Searching all discounts..." // Showing the placeholder for query.
                            onQueryChange={handleFiltersQueryChange} // Action triggered when the query changes.
                            onQueryClear={() => setQueryValue("")} // Clear the query.
                            cancelAction={{
                                // Handle the query cancel action.
                                onAction: onHandleCancel,
                                disabled: false,
                                loading: false,
                            }}
                            // primaryAction={primaryAction}   // Used to handle the query save action.

                            hideFilters
                            // hideQueryField   // Used to hide the query field

                            mode={mode} // The mode of IndexFilters component.
                            setMode={setMode}
                            loading={pageLoader}
                        />
                        <Box paddingBlockStart={100} minHeight="2rem">
                            <InlineStack align="end">
                                {selectedResources.length > 0 ? (
                                    <Badge tone="warning">
                                        <InlineStack gap={100}>
                                            <Text variant="headingSm">{ t("total_active_discounts", {total: activeDiscounts, max: maxActiveDiscounts}) }</Text>
                                            <Tooltip content={ t("maximum_active_discounts", {max: maxActiveDiscounts}) } dismissOnMouseOut>
                                                <Icon source={QuestionCircleIcon} tone="base" />
                                            </Tooltip>
                                        </InlineStack>
                                    </Badge>
                                ) : (
                                    <Badge>
                                        <Text variant="headingSm">{ t("total_discounts_count", {count: initialDiscounts.length}) }</Text>
                                    </Badge>
                                )}
                            </InlineStack>
                        </Box>
                        <IndexTable
                            promotedBulkActions={promotedBulkActions}
                            headings={[
                                { title: t("title") },
                                { title: t("status") },
                                { title: t("type") },
                                { title: t("starts_at") },
                                { title: t("ends_at") },
                            ]}
                            resourceName={resourceName}
                            itemCount={discounts.length}
                            onSelectionChange={handleSelectionChange}
                            onNavigation={() => {}}
                            selectedItemsCount={allResourcesSelected ? t("all") : selectedResources.length}
                        >
                            {discounts.map((discount, index) => {
                                const { id, title, status, type, discountId, startsAt, endsAt, createdAt, updatedAt } = discount;
                                let discount_type = type == "QUANTITY_DISCOUNT" ? "quantity-discount" : "price-discount";
                                let function_id = type == "QUANTITY_DISCOUNT" ? quantityDiscountFunctionId : priceDiscountFunctionId;
                                let current_gid = extractIdFromShopifyUrl(discountId);
                                let url = `/app/${discount_type}/${function_id}/${current_gid}?headback=list`;
                                return (
                                    <IndexTable.Row
                                        id={id}
                                        key={id}
                                        selected={selectedResources.includes(id)}
                                        position={index}
                                        onNavigation={() => navigate(url)}
                                    >
                                        <IndexTable.Cell>
                                            <Box paddingBlock={200} data-primary-link data-polaris-unstyled>
                                                <Text fontWeight="semibold">{title}</Text>
                                            </Box>
                                        </IndexTable.Cell>

                                        <IndexTable.Cell>
                                            {status == "ACTIVE" ? (
                                                <Badge tone="success">{ t("active") }</Badge>
                                            ) : status == "EXPIRED" ? (
                                                <Badge tone="critical">{ t("expired") }</Badge>
                                            ) : (
                                                <Badge tone="attention">{ t("scheduled") }</Badge>
                                            )}
                                        </IndexTable.Cell>
                                        <IndexTable.Cell>
                                            <Text>{type == "PRICE_DISCOUNT" ? t("price_discount") : t("quantity_discount")}</Text>
                                        </IndexTable.Cell>
                                        <IndexTable.Cell>
                                            <Text>{getFormattedDateTime({timezoneOffset: timezoneOffsetMinutes, dateString: startsAt})}</Text>
                                        </IndexTable.Cell>
                                        <IndexTable.Cell>
                                            <Text>{endsAt ? getFormattedDateTime({timezoneOffset: timezoneOffsetMinutes, dateString: endsAt}) : "-"}</Text>
                                        </IndexTable.Cell>
                                    </IndexTable.Row>
                                );
                            })}
                        </IndexTable>
                    </Card>
				</Page>
			</Bleed>
			<ui-modal id="delete-modal">
				<Box padding={400}>
					<p>{ t("you_are_about_to_action_discount", { action: t("delete") }) }</p>
				</Box>
				<ui-title-bar title={ t("action_discount_confirmation", { action: t("delete") }) }>
					<button
						variant="primary"
						tone="critical"
						onClick={() => deleteDiscount()}
					>
						{ t("yes_action", { action: t("delete") }) }
					</button>
					<button onClick={() => closeDeleteModal()}>{ t("cancel") }</button>
				</ui-title-bar>
			</ui-modal>
			<ui-modal id="discounts-active-modal">
				<Box padding={400}>
					<p>{ t("you_are_about_to_action_discount", { action: t("activate") }) }</p>
				</Box>
				<ui-title-bar title={ t("action_discount_confirmation", { action: t("activate") }) }>
					<button
						variant="primary"
						onClick={() => activateDiscount()}
					>
						{ t("yes_action", { action: t("activate") }) }
					</button>
					<button onClick={() => closeActiveDiscountsModal()}>{ t("cancel") }</button>
				</ui-title-bar>
			</ui-modal>
			<ui-modal id="discounts-deactive-modal">
				<Box padding={400}>
					<p>{ t("you_are_about_to_action_discount", { action: t("deactivate") }) }</p>
				</Box>
				<ui-title-bar title={ t("action_discount_confirmation", { action: t("deactivate") }) }>
					<button
						variant="primary"
						tone="critical"
						onClick={() => deactivateDiscount()}
					>
						{ t("yes_action", { action: t("deactivate") }) }
					</button>
					<button onClick={() => closeDeactiveDiscountsModal()}>{ t("cancel") }</button>
				</ui-title-bar>
			</ui-modal>
		</BlockStack>
	);
}

function isSubstring(smallString, largeString) {
	return largeString.toLowerCase().indexOf(smallString.toLowerCase()) !== -1;
}

function extractIdFromShopifyUrl(url) {
	// Regular expression to match the pattern gid://shopify/DiscountAutomaticNode/ followed by digits
	const regex = /gid:\/\/shopify\/DiscountAutomaticNode\/(\d+)/;
	const match = url.match(regex);

	// Check if there's a match
	if (match) {
		// Extract the captured group (digits) and return it
		return match[1];
	} else {
		// Handle the case where the URL doesn't match the pattern
		return null; // Or you can throw an error if preferred
	}
}
