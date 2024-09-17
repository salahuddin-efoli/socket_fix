import { Link, useActionData, useLoaderData, useNavigate, useNavigation, useParams, useSearchParams, useSubmit } from "@remix-run/react";
import { Badge, Bleed, BlockStack, Box, Button, ButtonGroup, Card, Checkbox, Divider, EmptyState, Grid, Icon, InlineGrid, InlineStack, Page, RadioButton, SkeletonBodyText, SkeletonDisplayText, Sticky, Text, TextField, Tooltip } from "@shopify/polaris";
import { ArrowLeftIcon, SearchIcon, QuestionCircleIcon } from "@shopify/polaris-icons";
import { useEffect, useState } from "react";
import prisma from "../db.server";
import DrDatePicker from "../components/DrDatePicker";
import DrTimePicker from "../components/DrTimePicker";
import IncludeTags from "../components/IncludeTags";
import ProductTypes from "../components/ProductTypes";
import ProductVendors from "../components/ProductVendors";
import Summary from '../components/Summary';
import TopBanner from '../components/TopBanner';
import SelectionModal from '../components/modal/SelectionModal';
import SelectionRangeModal from '../components/modal/SelectionRangeModal';
import SelectedItem from '../components/partial/SelectedItem';
import { createActivityLog, getFormattedDateTime } from '../libs/helpers';
import validator from "../libs/validator";
import ProductList from "../components/ProductList";
import RangeInfoQuantity from "../components/partial/RangeInfoQuantity";
import { authenticate } from "../shopify.server";
import "../styles/global.css";
import { useTranslation } from "react-i18next";

export const loader = async ({ request, params }) => {
    const { admin } = await authenticate.admin(request);

    const response = await admin.graphql(
        `#graphql
        query mainQuery($id: ID!) {
            shop {
                currencyCode
            }
            discountNode(id: $id) {
                id
                discount {
                    ... on DiscountAutomaticApp {
                        title
                        status
                        startsAt
                        endsAt
                    }
                }
                metafield(key: "dr-quantity-discount-function-configuration", namespace: "$app:quantity-discount") {
                    id
                    namespace
                    key
                    value
                }
            }
        }`, {
        variables: {
            id: `gid://shopify/DiscountAutomaticNode/${params.id}`,
        },
    });
    const responseJson = await response.json();

    const shopInfoResponse = await admin.graphql(`query mainQuery { shop { myshopifyDomain timezoneOffset timezoneOffsetMinutes } }`);
	const shopInfoResponseJson = await shopInfoResponse.json();
    const myshopifyDomain = shopInfoResponseJson.data.shop.myshopifyDomain;

    const maxActiveDiscounts = 5;
    const activeDiscounts = await prisma.discounts.aggregate({
        _count: {
            id: true,
        },
        where: {
            deletedAt: null,
            shop: {
                myshopifyDomain: myshopifyDomain,
            },
            status: "ACTIVE",
        }
    });

    const quantityDiscounts = await prisma.discounts.findMany({
        select: {
            id: true,
            title: true,
            discountValues: true,
        },
        where: {
            shop: {
                myshopifyDomain: myshopifyDomain,
            },
            type: "QUANTITY_DISCOUNT",
            deletedAt: null,
        }
    });
    return {
        target: "get-discount",
        message: "Response data",
        data: responseJson.data || {},
        discounts: quantityDiscounts,
        maxActiveDiscounts: maxActiveDiscounts,
        activeDiscounts: activeDiscounts._count.id || 0,
        timezoneOffset: shopInfoResponseJson?.data?.shop?.timezoneOffset,
        timezoneOffsetMinutes: shopInfoResponseJson?.data?.shop?.timezoneOffsetMinutes,
        functionIds: {
            quantityDiscountFID: import.meta.env.VITE_PRICE_DISCOUNT_FUNCTION_ID,
            priceDiscountFID: import.meta.env.VITE_PRICE_DISCOUNT_FUNCTION_ID,
        }
    };
};

export const action = async ({ params, request }) => {
    const { admin } = await authenticate.admin(request);
	const shopInfoResponse = await admin.graphql(`query mainQuery { shop { myshopifyDomain } }`);
	const shopInfoResponseJson = await shopInfoResponse.json();
    const myshopifyDomain = shopInfoResponseJson.data.shop.myshopifyDomain;

    const formdata = await request.formData();
    const target = formdata.get("target");
    const graphqlQuery = formdata.get("graphqlQuery") || "";
    const queryParams = formdata.get("queryParams") || "";

    try {
        // Setting the appropriate graphQl query for action depending on target
        if (graphqlQuery && graphqlQuery != '') {
            // Check if is action is for creating the discount
            if (target == "update-discount") {

                const discountData = JSON.parse(queryParams).variables.automaticAppDiscount || {};

                // Check if any discount exists with this same title
                const discountNodesResponse = await admin.graphql(
                    `#graphql
                    query($query: String) {
                        discountNodes(first: 1, query: $query) {
                            nodes {
                                id
                            }
                        }
                    }`, {
                        variables: {
                            query: `title:${discountData.title} AND status:active AND -id:${params.id}`,
                        },
                    }
                );
                const discountNodes = await discountNodesResponse.json();
                // If yes, then return error
                if(discountNodes?.data?.discountNodes?.nodes?.length > 0) {
                    return {
                        target: "error",
                        message: "title_must_be_unique",
                        data: [],
                    };
                }

                const response = await admin.graphql(graphqlQuery, JSON.parse(queryParams));
                const responseJson = await response.json();
                //in case of create-discount, prisma operations
                if (responseJson?.data?.discountAutomaticAppUpdate?.automaticAppDiscount?.discountId) {
                    // Update the copy of the discount in app database
                    const discountId = JSON.parse(queryParams).variables.id || "";
                    // First find the first discount with this discount ID
                    const quantityDiscount = await prisma.discounts.findFirst({
                        select: {
                            id: true,
                            shopId: true,
                            shop: {
                                select: {
                                    myshopifyDomain: true,
                                }
                            }
                        },
                        where: {
                            discountId: discountId,
                            deletedAt: null
                        },
                        orderBy: {
                            id: 'desc',
                        },
                    });

                    // Update this discount by ID
                    const updatedDiscountInfo = await prisma.discounts.update({
                        where: {
                            id: quantityDiscount?.id,
                        },
                        data: {
                            title: discountData.title,
                            startsAt: discountData.startsAt,
                            endsAt: discountData.endsAt,
                            status: responseJson.data.discountAutomaticAppUpdate.automaticAppDiscount.status,
                            discountValues: discountData.metafields[0].value,
                            updatedAt: new Date().toISOString(),
                        }
                    });
                    createActivityLog({type: "success", shop: myshopifyDomain, subject: "Quentity discount updated", body: updatedDiscountInfo});

                    return {
                        target: "update-discount",
                        message: "Success",
                        data: [],
                    };
                }
                else {
                    createActivityLog({type: "error", shop: myshopifyDomain, subject: "Update discount", body: responseJson, query: graphqlQuery, variables: queryParams});
                    return {
                        target: "error",
                        message: "update_discount_error",
                        data: [],
                    };
                }
            }
            else if (target == "delete-discount") {
                const graphqlQuery = formdata.get("graphqlQuery") || "";
                const queryParams = formdata.get("queryParams") || "";

                const response = await admin.graphql(graphqlQuery, JSON.parse(queryParams));
                const responseJson = await response.json();

                if (responseJson?.data?.discountAutomaticDelete?.deletedAutomaticDiscountId) {
                    const discountId = responseJson.data.discountAutomaticDelete.deletedAutomaticDiscountId || "";
                    // First find the first discount with this discount ID
                    const quantityDiscount = await prisma.discounts.findFirst({
                        where: {
                            discountId: discountId,
                            deletedAt: null
                        },
                        include: { shop: true },
                        orderBy: {
                            id: 'desc',
                        },
                    });

                    // Now update the deleted at value of this discount by ID
                    await prisma.discounts.update({
                        where: {
                            id: quantityDiscount?.id,
                        },
                        data: {
                            deletedAt: new Date().toISOString(),
                        }
                    });
                    createActivityLog({type: "success", shop: myshopifyDomain, subject: "Delete discount", body: responseJson});

                    return {
                        target: "delete-discount",
                        message: "Success",
                        data: responseJson.data || {},
                    };
                }
                else {
                    createActivityLog({type: "error", shop: myshopifyDomain, subject: "Delete discount", body: responseJson, query: graphqlQuery, variables: queryParams});
                    return {
                        target: "error",
                        message: "delete_discount_error",
                        data: [],
                    };
                }
            }
            else {
                const response = await admin.graphql(graphqlQuery, JSON.parse(queryParams));
                const responseJson = await response.json();
                let data = [];
                if (target == "segment") {
                    data = responseJson.data.segments || [];
                }
                else if (target == "customer") {
                    data = responseJson.data.customers || [];
                }
                else if (target == "productVariants") {
                    data = responseJson.data.productVariants || [];
                }
                else if (target == "productType") {
                    data = responseJson.data.products.edges.filter(item => item.node.productType != '') || [];
                }
                else if (target == "productVendor") {
                    data = responseJson.data.products.edges.filter(item => item.node.vendor != '') || [];
                }
                else if (target == "productTags") {
                    data = responseJson.data.products.edges.filter(item => item.node.tags.length > 0) || [];
                }
                return {
                    target: target,
                    message: "Response data",
                    data: data || [],
                };
            }
        }
    } catch (err) {
        createActivityLog({type: "error", shop: myshopifyDomain, subject: `Discount operation: ${target}`, body: err, query: graphqlQuery, variables: queryParams});
        return {
            target: "error",
            message: "something_went_wrong",
            data: err,
        };
    }
};

export default function QuantityDiscount() {
    const { t } = useTranslation();
    const submit = useSubmit();
    const navigate = useNavigate();
    const params = useParams();
    const loaderData = useLoaderData() || {};
    const actionData = useActionData() || {};

    const maxActiveDiscounts = loaderData?.maxActiveDiscounts;
    const activeDiscounts = loaderData?.activeDiscounts;
    const timezoneOffset = loaderData?.timezoneOffset;
    const timezoneOffsetMinutes = loaderData?.timezoneOffsetMinutes;
	const functionId = loaderData?.functionIds?.quantityDiscountFID;

    const [searchParams, setSearchParams] = useSearchParams();
    const [isNewlyCreated, setIsNewlyCreated] = useState();
    const [headbackPage, setHeadbackPage] = useState("");
    const [unsavedForm, setUnsavedForm] = useState(false);

    const [pageLoader, setPageLoader] = useState(true);
    const [formLoader, setFormLoader] = useState(false);
    const [deleteLoader, setDeleteLoader] = useState(false);
    const [formSubmitted, setFormSubmitted] = useState(false);
    const [discountNodeNotFound, setDiscountNodeNotFound] = useState(false);


    /**
     * this area hold all state and default value
     */
    const [formState, setFormState] = useState({
        title: "",
        quantity_range: "",
        ranges: [{ id: new Date().getTime(), quantity: 1, amount: 0, percent_or_currency: "%" }],
        status: "",
        start_date: "",
        start_time: "",
        end_date: "",
        end_time: "",
        apply_type: "",
        customer_eligibility: "",
        segments: [],
        customers: [],
        include_tags: [],
        exclude_tags: [],
        products: [],
        collections: [],
        vendors: [],
        types: [],
        set_end_date_and_time: false,
        check_exclude_tag: false
    });
    const [initialFormState, setInitialFormState] = useState({
        title: "",
        quantity_range: "",
        ranges: [{ id: new Date().getTime(), quantity: 1, amount: 0, percent_or_currency: "%" }],
        status: "",
        start_date: "",
        start_time: "",
        end_date: "",
        end_time: "",
        apply_type: "",
        customer_eligibility: "",
        segments: [],
        customers: [],
        include_tags: [],
        exclude_tags: [],
        products: [],
        collections: [],
        vendors: [],
        types: [],
        set_end_date_and_time: false,
        check_exclude_tag: false
    });

    const [formError, setFormError] = useState({
        title: "",
        ranges: "",
        status: "",
        start_date: "",
        start_time: "",
        set_end_date_and_time: "",
        end_date: "",
        end_time: "",
        customer_eligibility: "",
        segments: "",
        customers: "",
        include_tags: "",
        products: "",
        collections: "",
        vendors: "",
        types: "",
        exclude_tags: "",
        check_exclude_tag: "",
    });

    // Initial start and end date
    const [initialStartsAt, setInitialStartsAt] = useState("");
    const [initialStartDate, setInitialStartDate] = useState("");
    const [initialStartTime, setInitialStartTime] = useState("");
    const [initialEndsAt, setInitialEndsAt] = useState("");
    const [initialEndDate, setInitialEndDate] = useState("");
    const [initialEndTime, setInitialEndTime] = useState("");
    const [metadataId, setMetadataId] = useState("");

    useEffect(() => {
        if(searchParams.get("headback")) {
            if(searchParams.get("headback") == "list") {
                setHeadbackPage("LP");
            }
            else if(searchParams.get("headback") == "home") {
                setHeadbackPage("HP");
            }
        }
        else {
            setHeadbackPage("AD");
        }
        if(searchParams.get("nc") && searchParams.get("nc") == 1) {
            setIsNewlyCreated(searchParams.get("nc"));
        }
        // delete nc on searchParams object
        searchParams.delete('nc');
        // reset URL searchParams to object with nc removed
        setSearchParams(searchParams);
    }, []);

    // load at page load
    useEffect(() => {
        if (loaderData?.data?.discountNode) {
            const discountData = loaderData.data.discountNode.discount;
            const metaData = JSON.parse(loaderData.data.discountNode.metafield.value) || {};
            const discountNodeMetaDataID = loaderData.data.discountNode.metafield.id || "";
            setMetadataId(discountNodeMetaDataID);
            const formData = {
                title: "",
                quantity_range: "",
                ranges: [],
                status: "",
                start_date: "",
                start_time: "",
                set_end_date_and_time: false,
                end_date: "",
                end_time: "",
                apply_type: "",
                include_tags: [],
                exclude_tags: [],
                products: [],
                collections: [],
                vendors: [],
                types: [],
                check_exclude_tag: false,
                customer_eligibility: "",
                segments: [],
                customers: [],
            };
            formData.title = discountData.title;
            formData.quantity_range = metaData.quantityRange;
            formData.ranges = metaData.ranges;
            formData.status = discountData.status;

            setInitialStartsAt(discountData.startsAt);
            const start_date = getFormattedDateTime({timezoneOffset: timezoneOffsetMinutes, dateString: discountData.startsAt, returnType: "d"});
            const start_time = getFormattedDateTime({timezoneOffset: timezoneOffsetMinutes, dateString: discountData.startsAt, returnType: "t"});
            setInitialStartDate(start_date);
            setInitialStartTime(start_time);
            formData.start_date = start_date;
            formData.start_time = start_time;

            formData.set_end_date_and_time = discountData.endsAt ? true : false;
            if (formData.set_end_date_and_time) {
                setInitialEndsAt(discountData.endsAt);
                const end_date = getFormattedDateTime({timezoneOffset: timezoneOffsetMinutes, dateString: discountData.endsAt, returnType: "d"});
                const end_time = getFormattedDateTime({timezoneOffset: timezoneOffsetMinutes, dateString: discountData.endsAt, returnType: "t"});
                setInitialEndDate(end_date);
                setInitialEndTime(end_time);
                formData.end_date = end_date;
                formData.end_time = end_time;
            }
            formData.apply_type = metaData.applyType;
            formData.include_tags = metaData.tags;
            formData.exclude_tags = metaData.excludetags;
            formData.products = metaData.products;
            formData.collections = metaData.collections;
            formData.vendors = metaData.vendors;
            formData.types = metaData.types;
            formData.customer_eligibility = metaData.customer_eligibility;
            formData.segments = metaData.segments;
            formData.customers = metaData.customers;
            formData.check_exclude_tag = JSON.parse(metaData.checkExcludeTag);

            setInitialFormState({ ...formData });
            setFormState({ ...formData });
        }
        else {
            setDiscountNodeNotFound(true);
        }
        setPageLoader(false);
    }, []);
    
    // Customer target state
    const customerOptions = [
        { id: "all", label: t("all_customers")},
        // { id: "segment", label: "Specific customer segments" },
        { id: "customer", label: t("specific_customer")},
    ];

    // apply type option  state
    const applyTypeOptions = [
        { id: "all", label: t("all_products") },
        { id: "product", label: t("specific_product") },
        { id: "collection", label: t("specific_collection") },
        { id: "tag", label: t("specific_tag") },
        { id: "vendor", label: t("specific_vendor") },
        { id: "type", label: t("specific_type") },
    ];

    // Update title
    const handleTitleChange = (newValue) => {
        setFormState({ ...formState, title: newValue });
        if(formSubmitted) {
            validateIndividualField({fieldName: "title", fieldValue: newValue});
        }
    };

    // change quantity range option
    const handleQunatityRangeOption = (newValue) => {
        setFormState({ ...formState, quantity_range: newValue });
    };
    const updateRange = (newValue) => {
        setFormState({ ...formState, ranges: [ ...newValue ]});
    };

    // Status state
    const statusOptions = [
        { value: "ACTIVE", label: t("activate")},
        { value: "EXPIRED", label: t("deactivate")},
        { value: "SCHEDULED", label: t("scheduled")},
    ];
    // Change status
    const handleStatusChange = (newValue) => {
        if(newValue == "ACTIVE" || newValue == "EXPIRED") {
            setFormState({
                start_date: "",
                start_time: "",
                set_end_date_and_time: false,
                end_date: "",
                end_time: "",
            });
            setFormError({
                start_date: "",
                start_time: "",
                set_end_date_and_time: "",
                end_date: "",
                end_time: "",
            });
        }
        setFormState({ ...formState, status: newValue});
        if(formSubmitted) {
            validateIndividualField({fieldName: "status", fieldValue: newValue});
        }
    };
    // Update start date
    const handleStartDateChange = (newValue) => {
        setFormState({ ...formState, start_date: newValue });
        if(formSubmitted) {
            validateIndividualField({fieldName: "start_date", fieldValue: newValue, secondaryFieldName: "status", secondaryFieldValue: formState.status});
        }
    };

    // Update start time
    const handleStartTimeChange = (newValue) => {
        setFormState({ ...formState, start_time: newValue });
        if(formSubmitted) {
            validateIndividualField({fieldName: "start_time", fieldValue: newValue, secondaryFieldName: "status", secondaryFieldValue: formState.status});
        }
    };

    const handleSetEndTime = (newValue) => {
        setFormState({ ...formState, set_end_date_and_time: newValue, end_date: "", end_time: "" });
    }

    // Update end date
    const handleEndDateChange = (newValue) => {
        setFormState({ ...formState, end_date: newValue });
        if(formSubmitted) {
            validateIndividualField({fieldName: "end_date", fieldValue: newValue, secondaryFieldName: "set_end_date_and_time", secondaryFieldValue: formState.set_end_date_and_time});
        }
    };

    // Update end time
    const handleEndTimeChange = (newValue) => {
        setFormState({ ...formState, end_time: newValue });
        if(formSubmitted) {
            validateIndividualField({fieldName: "end_time", fieldValue: newValue, secondaryFieldName: "set_end_date_and_time", secondaryFieldValue: formState.set_end_date_and_time});
        }
    };

    // change apply type
    const handleApplyType = (newValue) => {
        setFormState({ ...formState, apply_type: newValue, products: [], collections: [], include_tags: [], vendors: [], types: [] });
        setFormError({
            products: "",
            collections: "",
            include_tags: "",
            vendors: "",
            types: "",
        });
    };

    // range keyword state
    const [rangeKeyword, setRangeKeyword] = useState('');
    // Update range keyword
    const handleRangeKeywordChange = (newValue) => {
        setRangeKeyword(newValue);
        setRangesModal(true);
    };

    const [rangesModal, setRangesModal] = useState(false);
    const openRangesModal = () => {
        setRangesModal(true);
    };
    const closeRangesModal = () => {
        setRangesModal(false);
        setRangeKeyword("");
    };

    const getSelectedRange = (newValue) => {
        setFormState({ ...formState, ranges: [ ...newValue ]});
        closeRangesModal();
    }
    // Update time customer target
    const handleCustomerTargetChange = (isSet, newValue) => {
        setFormState({ ...formState, customer_eligibility: newValue, segments: [], customers: [] });
        setFormError({
            segments: "",
            customers: "",
        });
    };
    // Keyword state
    const [keyword, setKeyword] = useState('');
    // Update keyword
    const handleCustomerKeywordChange = (newValue) => {
        setKeyword(newValue);
        setCustomerSegmentModal(true);
    };

    // Keyword state
    const [customerSegmentModal, setCustomerSegmentModal] = useState(false);
    // Update keyword
    const openCustomerSegmentModal = () => {
        setCustomerSegmentModal(true);
    };
    const closeCustomerSegmentModal = () => {
        setCustomerSegmentModal(false);
        setKeyword("");
    };

    const getSelectedData = (newValue) => {
        if (formState.customer_eligibility == "segment") {
            setFormState({ ...formState, segments: [...newValue] });
            if(formSubmitted) {
                validateIndividualField({fieldName: "segments", fieldValue: newValue, secondaryFieldName: "customer_eligibility", secondaryFieldValue: formState.customer_eligibility});
            }
        }
        else if (formState.customer_eligibility == "customer") {
            setFormState({ ...formState, customers: [...newValue] });
            if(formSubmitted) {
                validateIndividualField({fieldName: "customers", fieldValue: newValue, secondaryFieldName: "customer_eligibility", secondaryFieldValue: formState.customer_eligibility});
            }
        }
        closeCustomerSegmentModal();
    }
    const removeCustomer = (customerId) => {
        const newList = formState.customers.filter(customer => {
            const item = customer;
            if (item.id != customerId) {
                return customer;
            }
        });
        setFormState({ ...formState, customers: [...newList] });
        if(formSubmitted) {
            validateIndividualField({fieldName: "customers", fieldValue: newList, secondaryFieldName: "customer_eligibility", secondaryFieldValue: formState.customer_eligibility});
        }
    };
    const removeSegment = (segmentId) => {
        const newList = formState.segments.filter(segment => {
            const item = segment;
            if (item.id != segmentId) {
                return segment;
            }
        });
        setFormState({ ...formState, segments: [...newList] });
        if(formSubmitted) {
            validateIndividualField({fieldName: "segments", fieldValue: newList, secondaryFieldName: "customer_eligibility", secondaryFieldValue: formState.customer_eligibility});
        }
    };

    //this method set value for include tag
    const handleIncludeTags = (tagsArray) => {
        if (tagsArray.length > 0) {
            setFormState({ ...formState, include_tags: tagsArray });
            if(formSubmitted) {
                validateIndividualField({fieldName: "include_tags", fieldValue: tagsArray, secondaryFieldName: "apply_type", secondaryFieldValue: formState.apply_type});
            }
        }
    };

    //remove include tag
    const removeTag = (tag) => {
        let tagsArray = formState.include_tags.filter((item) => item != tag);
        setFormState({ ...formState, include_tags: tagsArray });
        if(formSubmitted) {
            validateIndividualField({fieldName: "include_tags", fieldValue: tagsArray, secondaryFieldName: "apply_type", secondaryFieldValue: formState.apply_type});
        }
    }

    //this method set value for exclude tag
    const handleExcludeTags = (excludetags) => {
        if (excludetags.length > 0) {
            setFormState({ ...formState, exclude_tags: excludetags });
        }
    };

    //remove exclude tag
    const removeExTag = (tag) => {
        let excludetags = formState.exclude_tags.filter((item) => item != tag);
        setFormState({ ...formState, exclude_tags: excludetags });
        if(formSubmitted) {
            validateIndividualField({fieldName: "exclude_tags", fieldValue: excludetags, secondaryFieldName: "apply_type", secondaryFieldValue: formState.apply_type});
        }
    };

    //this method set value for product Vendor
    const handleIncludeVendor = (vendorsArray) => {
        if (vendorsArray.length > 0) {
            setFormState({ ...formState, vendors: vendorsArray });
            if(formSubmitted) {
                validateIndividualField({fieldName: "vendors", fieldValue: vendorsArray, secondaryFieldName: "apply_type", secondaryFieldValue: formState.apply_type});
            }
        }
    };

    //remove include vendor
    const removeVendor = (vendor) => {
        let vendorsArray = formState.vendors.filter((item) => item !== vendor);
        setFormState({ ...formState, vendors: vendorsArray })
        if(formSubmitted) {
            validateIndividualField({fieldName: "vendors", fieldValue: vendorsArray, secondaryFieldName: "apply_type", secondaryFieldValue: formState.apply_type});
        }
    }


    //this method set value for product type
    const handleIncludeType = (typesArray) => {
        setFormState({ ...formState, types: typesArray });
        if(formSubmitted) {
            validateIndividualField({fieldName: "types", fieldValue: typesArray, secondaryFieldName: "apply_type", secondaryFieldValue: formState.apply_type});
        }
    };


    //remove include type
    const removeType = (type) => {
        let typesArray = formState.types.filter((item) => item !== type);
        setFormState({ ...formState, types: typesArray })
        if(formSubmitted) {
            validateIndividualField({fieldName: "types", fieldValue: typesArray, secondaryFieldName: "apply_type", secondaryFieldValue: formState.apply_type});
        }
    }

    //this method set value for exclude product tag
    const handleCheckExcludeTag = () => {
        let exclude_tags = formState.check_exclude_tag ? formState.exclude_tags : [];
        setFormState({ ...formState, check_exclude_tag: !formState.check_exclude_tag, exclude_tags: exclude_tags });
    };

    // fetch store product using resource picker and product add to the products state
    const handleProductChange = async (newValue) => {
        const seletionIds = getSelectedItems();
        let selectedProduct = await shopify.resourcePicker({
            type: formState.apply_type == "collection" ? "collection" : "product",
            action: "select",
            query: newValue,
            multiple: true,
            selectionIds: seletionIds,
        });

        if (selectedProduct && selectedProduct.length > 0) {
            if (formState.apply_type === 'product') {
                const uniqueProduct = new Map(formState.products.map((product) => [product.id, product]));
                selectedProduct.map((product) => {
                    const productItem = {
                        id: product.id,
                        images: product?.images?.length > 0 ? product.images[0].originalSrc : '',
                        title: product.title,
                        variants: product?.variants?.length > 0 ? product?.variants.map((item) => ({
                            id: item.id,
                            title: item.title,
                            inventoryQuantity: item.inventoryQuantity,
                            price: item.price
                        })) : undefined,
                        options: product?.options ? product.options[0].values : ""

                    }
                    uniqueProduct.set(product.id, productItem);
                });
                const productArray = Array.from(uniqueProduct.values());
                setFormState({ ...formState, products: productArray });
                if(formSubmitted) {
                    validateIndividualField({fieldName: "products", fieldValue: productArray, secondaryFieldName: "apply_type", secondaryFieldValue: formState.apply_type});
                }
            } else {
                const uniqueCollection = new Map(formState.collections.map((collection) => [collection.id, collection]));
                selectedProduct.map((collection) => {
                    const collectionItem = {
                        id: collection.id,
                        images: collection?.images?.length > 0 ? collection.images[0].originalSrc : '',
                        title: collection.title,
                        options: ""

                    }
                    uniqueCollection.set(collection.id, collectionItem);
                });
                const collectionArray = Array.from(uniqueCollection.values());
                setFormState({ ...formState, collections: collectionArray });
                if(formSubmitted) {
                    validateIndividualField({fieldName: "collections", fieldValue: collectionArray, secondaryFieldName: "apply_type", secondaryFieldValue: formState.apply_type});
                }
            }
        }
    };

    const removeProduct = (id) => {
        if (formState.apply_type == 'collection') {
            const collectionArray = formState.collections.filter((collection) => collection.id != id);
            setFormState({ ...formState, collections: collectionArray });
            if(formSubmitted) {
                validateIndividualField({fieldName: "collections", fieldValue: collectionArray, secondaryFieldName: "apply_type", secondaryFieldValue: formState.apply_type});
            }
        } else {
            const productArray = formState.products.filter((product) => product.id != id);
            setFormState({ ...formState, products: productArray });
            if(formSubmitted) {
                validateIndividualField({fieldName: "products", fieldValue: productArray, secondaryFieldName: "apply_type", secondaryFieldValue: formState.apply_type});
            }
        }
    };

    const updateProductsVariants = (id, newVariants) => {
        const updateVariants = formState.products.map((product) => {
            if (product.id === id) {
                return { ...product, variants: newVariants };
            }
            return product;
        });
        if (formState.apply_type === 'collection') {
            setFormState({ ...formState, collections: updateVariants });
        } else {
            setFormState({ ...formState, products: updateVariants });
        }
    };

    //this method used for preselected id and its variants and alos selected for collection
    const getSelectedItems = () => {
        if (formState.apply_type === "collection") {
            return formState.collections.map((collection) => {
                const collectionInfo = {
                    id: `${collection.id}`,
                };
                return collectionInfo;
            });

        } else {
            return formState.products.map((product) => {
                if (product?.variants) {
                    const productInfo = {
                        id: `${product.id}`,
                        variants: product.variants.map((variant) => ({
                            id: `${variant.id}`,
                        })),
                    };
                    return productInfo;
                } else {
                    const productInfo = {
                        id: `${product.id}`,
                    };
                    return productInfo;
                }
            });
        }

    };

    // Validate title
    const validateIndividualField = ({fieldName, fieldValue, secondaryFieldName = "", secondaryFieldValue = ""}) => {
        const validate = validator({
            [fieldName]: fieldValue,
            [secondaryFieldName]: secondaryFieldValue
        }, {
            [fieldName]: fieldName == "title" ? "required|string|minLength:5|maxLength:150"
                        : fieldName == "ranges" ? "required"
                        : fieldName == "status" ? "required"
                        : fieldName == "start_date" ? "requiredIf:status,SCHEDULED"
                        : fieldName == "start_time" ? "requiredIf:status,SCHEDULED"
                        : fieldName == "end_date" ? "requiredIf:set_end_date_and_time,true"
                        : fieldName == "end_time" ? "requiredIf:set_end_date_and_time,true"
                        : fieldName == "customer_eligibility" ? "required"
                        : fieldName == "segments" ? "requiredIf:customer_eligibility,segment"
                        : fieldName == "customers" ? "requiredIf:customer_eligibility,customer"
                        : fieldName == "include_tags" ? "requiredIf:apply_type,tag"
                        : fieldName == "products" ? "requiredIf:apply_type,product"
                        : fieldName == "collections" ? "requiredIf:apply_type,collection"
                        : fieldName == "vendors" ? "requiredIf:apply_type,vendor"
                        : fieldName == "types" ? "requiredIf:apply_type,type"
                        : fieldName == "exclude_tags" ? "requiredIf:check_exclude_tag,true"
                        : ""
        });

        const errorMessages = {
            [fieldName]: ""
        };
        if(validate.error) {
            const validationValue = validate.messages[fieldName] || null;
            if(validationValue) {
                errorMessages[fieldName] = t(validationValue.i18n_key, {
                    field: t(validationValue.i18n_properties.field),
                    ...(validationValue.i18n_properties.parameter && {parameter: t(validationValue.i18n_properties.parameter)}),
                    ...(validationValue.i18n_properties.field2 && {field2: t(validationValue.i18n_properties.field2)}),
                });
            }
        }
        setFormError({ ...formError, ...errorMessages });
    }

    /**
     * After submit data "submitForm" function send data to the action method
     */

    const submitForm = async () => {
        setFormSubmitted(true);
        // First take the submit button to loading state, so that accidental multiple clicks cannot happen
        setFormLoader(true);

        // Validate title
        const validate = validator(formState, {
            title: "required|string|minLength:5|maxLength:150",
            ranges: "required",
            status: "required",
            start_date: "requiredIf:status,SCHEDULED",
            start_time: "requiredIf:status,SCHEDULED",
            end_date: "requiredIf:set_end_date_and_time,true",
            end_time: "requiredIf:set_end_date_and_time,true",
            customer_eligibility: "required",
            segments: "requiredIf:customer_eligibility,segment",
            customers: "requiredIf:customer_eligibility,customer",
            include_tags: "requiredIf:apply_type,tag",
            products: "requiredIf:apply_type,product",
            collections: "requiredIf:apply_type,collection",
            vendors: "requiredIf:apply_type,vendor",
            types: "requiredIf:apply_type,type",
            exclude_tags: "requiredIf:check_exclude_tag,true",
        });

        setFormError({
            title: "",
            ranges: "",
            status: "",
            start_date: "",
            start_time: "",
            set_end_date_and_time: "",
            end_date: "",
            end_time: "",
            customer_eligibility: "",
            segments: "",
            customers: "",
            include_tags: "",
            products: "",
            collections: "",
            vendors: "",
            types: "",
            exclude_tags: "",
            check_exclude_tag: "",
        });
        // If error found show error
        if (validate.error) {
            /**
             * * We just can not show messages as it is. We have to trnslate them before showing
             * TODO: Loop through the error messages object retirned from validator
             * TODO: The object "key" is the field name
             * TODO: And the "value" is an object containing needed information for translation
             * TODO: The "value" object has two properties
             * TODO:    1. "i18n_key", the key-string to get actual translated string
             * TODO:    2. "i18n_properties", is an object and it's the required dynamic values for the translated string
             * TODO: "i18n_properties" can have three properties at a time
             * TODO:    1. "field", will always be present
             * TODO:    2. "parameter" and "field2" are occasional
             * TODO: After translating all messages set it to the erro message state
             */
            const errorMessages = {};
            for (const [key, value] of Object.entries(validate.messages)) {
                errorMessages[key] = t(value.i18n_key, {
                    field: t(value.i18n_properties.field),
                    ...(value.i18n_properties.parameter && {parameter: t(value.i18n_properties.parameter)}),
                    ...(value.i18n_properties.field2 && {field2: t(value.i18n_properties.field2)}),
                });
            }
            setFormError({ ...errorMessages });
            setFormLoader(false);

            let firstPropertyValue
            // Exit after accessing the first value
            for (const key in errorMessages) {
                firstPropertyValue = errorMessages[key];
                break; 
            }
            shopify.toast.show(firstPropertyValue, { isError: true });
        }

        // If no error then save the discount
        else {
            // Configure all values for easier management
            const title = formState.title;

            /**
             * * How to set start and end datetime
             * TODO: First check whether discount status/start_date/start_time/end_date/end_time unchanged
             * TODO: If it is unchaged, then keep the start and end datetime as it is
             * TODO: If it was changed, we need to update start and end datetime
             * TODO: Now, if the new status is ACTIVE | Set the start datetime to current datetime, and set the end datetime to NULL
             * TODO: And, if the new status is EXPIRED | Set both the start and end datetime to current datetime
             * TODO: And, if the new status is SCHEDULED | Set both the start and end datetime to selected datetime
             */
            let startsAt = new Date(initialStartsAt).toISOString();
            let endsAt = initialEndsAt ? new Date(initialEndsAt).toISOString() : null;
            if(formState.status != initialFormState.status
                || formState.start_date != initialFormState.start_date
                || formState.start_time != initialFormState.start_time
                || formState.end_date != initialFormState.end_date
                || formState.end_time != initialFormState.end_time
            ) {
                if(formState.status == "ACTIVE") {
                    startsAt = new Date().toISOString();
                    endsAt = null;
                }
                else if(formState.status == "EXPIRED") {
                    startsAt = new Date().toISOString();
                    endsAt = startsAt;
                }
                else if(formState.status == "SCHEDULED") {
                    startsAt = new Date(`${formState.start_date} ${formState.start_time}`).toISOString();
                    if(formState.set_end_date_and_time) {
                        endsAt = new Date(`${formState.end_date} ${formState.end_time}`).toISOString();
                    }
                    else {
                        endsAt = null;
                    }
                }
            }

            const metaValues = {
                quantityRange: "new",
                ranges: formState.ranges,
                endTimeChecked: formState.set_end_date_and_time,
                applyType: formState.apply_type,
                products: formState.products,
                vendors: formState.vendors,
                collections: formState.collections,
                types: formState.types,
                checkExcludeTag: formState.check_exclude_tag,
                customer_eligibility: formState.customer_eligibility,
                segments: formState.segments,
                customers: formState.customers,
                selectedCollectionIds: formState.collections.map(item=>item.id),
                tags: formState.include_tags,
                excludetags: formState.exclude_tags,

                
            };

            const graphqlQuery = `#graphql
                mutation discountAutomaticAppUpdate($automaticAppDiscount: DiscountAutomaticAppInput!, $id: ID!) {
                    discountAutomaticAppUpdate(automaticAppDiscount: $automaticAppDiscount, id: $id) {
                        automaticAppDiscount {
                            discountId
                            title
                            startsAt
                            endsAt
                            status
                            appDiscountType {
                                appKey
                                functionId
                            }
                            combinesWith {
                                productDiscounts
                            }
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }
            `;
            const queryParams = {
                variables: {
                    automaticAppDiscount: {
                        title: title,
                        startsAt: startsAt,
                        endsAt: endsAt,
                        combinesWith: {
                            productDiscounts: true
                        },
                        metafields: [
                            {
                                id: metadataId,
                                value: JSON.stringify(metaValues),
                            }
                        ],
                    },
                    id: `gid://shopify/DiscountAutomaticNode/${params.id}`,
                }
            };

            submit({
                target: "update-discount",
                graphqlQuery: graphqlQuery,
                queryParams: JSON.stringify(queryParams),
            }, { method: "POST" });
        }
    }

    /**
     * this area hold all return data from outside  "OfferList" method
     */
    const nav = useNavigation();
    const isloading = nav.state === "submitting";
    //this function is passed in parent provided function for child
    const rangesArr = (arr) => {
        formState.ranges = [...arr]
    }

    const deleteDiscount = () => {
        setDeleteLoader(true);
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
                }
            `;
        const queryParams = {
            variables: {
                id: `gid://shopify/DiscountAutomaticNode/${params.id}`,
            }
        };

        submit({
            target: "delete-discount",
            graphqlQuery: graphqlQuery,
            queryParams: JSON.stringify(queryParams),
        }, { method: "POST" });
    }
    // Customer Segment modal state
    const [deleteModal, setDeleteModal] = useState(false);
    // Update customer Segment modal state
    const openDeleteModal = () => {
        setDeleteModal(true);
        shopify.modal.show('delete-modal');
    };
    const closeDeleteModal = () => {
        setDeleteModal(false);
        shopify.modal.hide('delete-modal');
    };

    const [repeaterCount, setRepeaterCount] = useState(0);

    const dynamicQuantityRangeRowObj = { repeaterCount, setRepeaterCount };

    const discardForm = () => {
        setFormError({
            title: "",
            ranges: "",
            status: "",
            start_date: "",
            start_time: "",
            set_end_date_and_time: "",
            end_date: "",
            end_time: "",
            customer_eligibility: "",
            segments: "",
            customers: "",
            include_tags: "",
            products: "",
            collections: "",
            vendors: "",
            types: "",
            exclude_tags: "",
            check_exclude_tag: "",
        });
        setFormState({...initialFormState});
        setUnsavedForm(false);
        setFormSubmitted(false);
    }

    useEffect(() => {
        if(initialFormState.title) {
            if(JSON.stringify(formState) != JSON.stringify(initialFormState)) {
                setUnsavedForm(true);
            }
            else {
                setUnsavedForm(false);
            }
        }
    }, [formState]);

    useEffect(() => {
        if(unsavedForm) {
            document.getElementById("dr-save-bar").show();
        }
        else {
            document.getElementById("dr-save-bar").hide();
        }
    }, [unsavedForm]);

    useEffect(()=>{
        if (actionData) {
            if (actionData.target == "error") {
                if (formLoader) {
                    setFormLoader(false);
                }
                if (deleteLoader) {
                    setDeleteLoader(false);
                }
                shopify.toast.show(t(actionData.message), { isError: true });
            }
            else if (actionData.target == "delete-discount" && actionData.message == "Success") {
                closeDeleteModal();
                if(headbackPage == "AD") {
                    open("shopify://admin/discounts", "_top");
                }
                else if(headbackPage == "HP") {
                    navigate(`/app`);
                }
                else {
                    navigate(`/app/offer-list`);
                }
            }
            else if (actionData.target == "update-discount" && actionData.message == "Success") {
                if (formLoader) {
                    setInitialFormState({ ...formState });
                    setUnsavedForm(false);
                    setFormLoader(false);
                }
                shopify.toast.show(t("discounts_action_successfully", { action: t("updated") }));
            }
        }

    }, [actionData])
    

    /**
    * this code used for summary controll
    */
    const [summary, setSummary] = useState(false)

    const handleSummaryDisplay = (newValue) => {
        setSummary(newValue)
    }
    
    return (
        <BlockStack>
            <ui-save-bar id="dr-save-bar">
                <button onClick={() => discardForm()} disabled={formLoader}></button>
                <button variant="primary" onClick={() => submitForm()} disabled={formLoader}></button>
            </ui-save-bar>
            <form onSubmit={(e) => { e.preventDefault(); submitForm() }} onReset={discardForm}>
                <Bleed>
                    <Page fullWidth>
                        <InlineStack wrap={false} blockAlign="center" gap={300}>
                            {headbackPage == "LP" && (
                                <Button icon={ArrowLeftIcon} size="large" url="/app/offer-list" disabled={unsavedForm} />
                            )}
                            {headbackPage == "HP" && (
                                <Button icon={ArrowLeftIcon} size="large" url="/app" disabled={unsavedForm} />
                            )}
                            {headbackPage == "AD" && (
                                <Button icon={ArrowLeftIcon} size="large" url="shopify://admin/discounts" target="_top" disabled={unsavedForm} />
                            )}
                            <Text>{ t("edit_quantity_discount") }</Text>
                        </InlineStack>
                        {isNewlyCreated && <TopBanner title={formState.title} onBannerDismiss={() => setIsNewlyCreated("")}></TopBanner>}
                        <Box background="bg-surface-selected" padding="200"></Box>
                        {pageLoader ? (
                            <BlockStack>
                                <Grid>
                                    <Grid.Cell columnSpan={{ xs: 6, lg: 8, xl: 8 }}>
                                        <BlockStack gap={400}>
                                            <Card>
                                                <BlockStack gap={200}>
                                                    <Text variant="headingSm">Title</Text>
                                                    <SkeletonDisplayText maxWidth='100%' />
                                                </BlockStack>
                                            </Card>
                                            <Card>
                                                <BlockStack gap={200}>
                                                    <Text variant="headingSm">Product</Text>
                                                    <SkeletonDisplayText maxWidth='100%' />
                                                </BlockStack>
                                            </Card>
                                            <Card>
                                                <BlockStack gap={200}>
                                                    <Text variant="headingSm">{ t("quantity_range") }</Text>
                                                    <Divider />
                                                    <InlineGrid gap={200} columns={['oneHalf', 'oneHalf']}>
                                                        <SkeletonDisplayText maxWidth='100%' />
                                                        <SkeletonDisplayText maxWidth='100%' />
                                                    </InlineGrid>
                                                    <SkeletonDisplayText />
                                                </BlockStack>
                                            </Card>
                                            <Card>
                                                <BlockStack gap={200}>
                                                    <Text variant="headingSm">{ t("active_dates") }</Text>
                                                    <Divider />
                                                    <InlineGrid gap={200} columns={['oneHalf', 'oneHalf']}>
                                                        <SkeletonDisplayText maxWidth='100%' />
                                                        <SkeletonDisplayText maxWidth='100%' />
                                                    </InlineGrid>
                                                    <SkeletonDisplayText size='small' />
                                                    <InlineGrid gap={200} columns={['oneHalf', 'oneHalf']}>
                                                        <SkeletonDisplayText maxWidth='100%' />
                                                        <SkeletonDisplayText maxWidth='100%' />
                                                    </InlineGrid>
                                                </BlockStack>
                                            </Card>
                                            <Card>
                                                <BlockStack gap={200}>
                                                    <Text variant="headingSm">{ t("customer_eligibility") }</Text>
                                                    <SkeletonBodyText lines={5} />
                                                </BlockStack>
                                            </Card>
                                        </BlockStack>
                                    </Grid.Cell>
                                    <Grid.Cell columnSpan={{ xs: 6, lg: 4, xl: 4 }}>
                                        <Card>
                                            <BlockStack gap={400}>
                                                <Text variant="headingSm">{ t("summary") }</Text>
                                                <Divider />
                                                <SkeletonBodyText lines={20} />
                                            </BlockStack>
                                        </Card>
                                    </Grid.Cell>
                                </Grid>
                            </BlockStack>
                        ) : discountNodeNotFound ? (
                            <Box padding={400} width="100%">
                                <EmptyState
                                    heading={ t("discount_not_found") }
                                    fullWidth={true}
                                    action={{
                                        content: t("create_discount"),
                                        url: `/app/quantity-discount/${functionId}/new`
                                    }}
                                    secondaryAction={{
                                        content: t("browse_item", {item: "discounts"}),
                                        url: "/app/offer-list"
                                    }}
                                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                                >
                                    <p>{ t("discount_not_found_message") }</p>
                                </EmptyState>
                            </Box>
                        ) : (
                            <BlockStack gap={400}>
                                <Grid>
                                    <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 8, xl: 8 }}>
                                        <Card>
                                            <BlockStack gap={200}>
                                                <Text as="h1" variant="headingSm">{ t("title") }</Text>
                                                <Divider />
                                                <Grid>
                                                    <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 10, xl: 10 }}>
                                                        <TextField
                                                            type="text"
                                                            placeholder={t("discount_name")}
                                                            name="title"
                                                            value={formState.title}
                                                            onChange={handleTitleChange}
                                                            helpText={t("unique_title_message")}
                                                            maxLength={150}
                                                            showCharacterCount
                                                        />
                                                    </Grid.Cell>
                                                </Grid>
                                                {formError.title && (
                                                    <Text as="p" tone="critical">{formError.title}</Text>
                                                )}
                                            </BlockStack>
                                        </Card>

                                        <Box padding="200"></Box>
                                        <Card>
                                            <BlockStack gap={200}>
                                                <Text as="h1" variant="headingSm">{ t("applies_to")}</Text>
                                                <Divider />
                                                <Box>
                                                    <BlockStack gap={300}>
                                                        <Grid gap={{xs: "0", sm: "0", md: "0", lg: "0", xl: "0"}}>
                                                            {applyTypeOptions.map((applyOption, index) => (
                                                                <Grid.Cell columnSpan={{ xs: 6, sm: 4 }} key={index}>
                                                                    <RadioButton
                                                                        label={applyOption.label}
                                                                        name="apply_type"
                                                                        checked={formState.apply_type == applyOption.id}
                                                                        onChange={() => handleApplyType(applyOption.id)}
                                                                    />
                                                                </Grid.Cell>
                                                            ))}
                                                        </Grid>
                                                        {(formState.apply_type === "product" || formState.apply_type === "collection") && (
                                                            <BlockStack gap={200}>
                                                                <Text as="h1" variant="headingSm">{ formState.apply_type === "product" ? t("specific_product") : (formState.apply_type === "collection" ? t("specific_collection") : "") }</Text>
                                                                <Grid>
                                                                    <Grid.Cell columnSpan={{ xs: 4, lg: 8 }}>
                                                                        <TextField
                                                                            type="text"
                                                                            placeholder={ t("browse_item", {item: t(`${formState.apply_type}s`).toLocaleLowerCase()}) }
                                                                            name="searchProducts"
                                                                            prefix={<Icon source={SearchIcon} tone="base" />}
                                                                            onFocus={() => handleProductChange()}
                                                                        />

                                                                        {(formError.products || formError.collections) && (
                                                                            <Text as="p" tone="critical">{formError.products || formError.collections}</Text>
                                                                        )}
                                                                    </Grid.Cell>

                                                                    <Grid.Cell columnSpan={{ xs: 2, lg: 2 }}>
                                                                        <Button icon={SearchIcon} size="large" onClick={() => handleProductChange("")} />
                                                                    </Grid.Cell>
                                                                </Grid>
                                                                <ProductList products={formState.products} collections={formState.collections} removeProduct={removeProduct} applyType={formState.apply_type} updateProductsVariants={updateProductsVariants}></ProductList>
                                                            </BlockStack>
                                                        )}

                                                        {formState.apply_type === "tag" && (
                                                            <BlockStack gap={200}>
                                                                <IncludeTags tags={formState.include_tags} handleTags={handleIncludeTags} removeTag={removeTag} />
                                                                {formError.include_tags && (
                                                                    <Text as="p" tone="critical">{formError.include_tags}</Text>
                                                                )}
                                                            </BlockStack>
                                                        )}
                                                        {formState.apply_type === "vendor" && (
                                                            <BlockStack gap={200}>
                                                                <ProductVendors  productVendors={formState.vendors} handleIncludeVendor={handleIncludeVendor} removeVendor={removeVendor}  />
                                                                {formError.vendors && (
                                                                    <Text as="p" tone="critical">{formError.vendors}</Text>
                                                                )}
                                                            </BlockStack>
                                                        )}
                                                        {formState.apply_type === "type" && (
                                                            <BlockStack gap={200}>
                                                                <ProductTypes  productTypes={formState.types} handleIncludeType={handleIncludeType} removeType={removeType} />
                                                                {formError.types && (
                                                                    <Text as="p" tone="critical">{formError.types}</Text>
                                                                )}
                                                            </BlockStack>
                                                        )}
                                                    </BlockStack>
                                                </Box>
                                            </BlockStack>
                                        </Card>

                                        <Box padding="200"></Box>

                                        <Card>
                                            <BlockStack gap={200}>
                                                <Checkbox label="Exclude product tag" checked={formState.check_exclude_tag} onChange={handleCheckExcludeTag} />
                                                {formState.check_exclude_tag && (
                                                    <IncludeTags tags={formState.exclude_tags} handleTags={handleExcludeTags} removeTag={removeExTag} excludeTag={true}/>
                                                )}
                                                {formError.exclude_tags && formState.check_exclude_tag && (
                                                    <Text as="p" tone="critical">{formError.exclude_tags.replace("CheckExcludeTag", "exclude product tag").replace("true", "checked")}</Text>
                                                )}
                                            </BlockStack>
                                        </Card>

                                        <Box padding="200"></Box>
                                        <Card>
                                            <BlockStack gap={200}>
                                                <Text as="h1" variant="headingSm">{ t("add_discount_on_quantity_range") }</Text>
                                                <Divider />
                                                <Grid>
                                                    <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 10, xl: 10 }}>
                                                        <ButtonGroup>
                                                            <RadioButton
                                                                label={t("preset_value")}
                                                                value="preset"
                                                                name="quantity_range"
                                                                onChange={() => handleQunatityRangeOption("preset")}
                                                                checked={formState.quantity_range == "preset" ? true : false}
                                                            />
                                                            <RadioButton
                                                                label={t("create_new")}
                                                                value="new"
                                                                name="quantity_range"
                                                                onChange={() => handleQunatityRangeOption("new")}
                                                                checked={formState.quantity_range == "new" ? true : false}
                                                            />
                                                        </ButtonGroup>
                                                    </Grid.Cell>
                                                </Grid>
                                                {formState.quantity_range == "preset" && (
                                                    <Grid>
                                                        <Grid.Cell columnSpan={{ xs: 5, lg: 10 }}>
                                                            <TextField
                                                                type="text"
                                                                placeholder={t("search_by_title")}
                                                                autoComplete="off"
                                                                prefix={<Icon source={SearchIcon} tone="base" />}
                                                                onFocus={() => handleRangeKeywordChange()}
                                                            />
                                                        </Grid.Cell>
                                                        <Grid.Cell columnSpan={{ xs: 1, lg: 1 }}>
                                                            <div className="flex full-height">
                                                                <BlockStack align="end">
                                                                    <Button tone="critical" icon={SearchIcon} size="large" onClick={openRangesModal} />
                                                                </BlockStack>
                                                            </div>
                                                        </Grid.Cell>
                                                    </Grid>
                                                )}
                                            </BlockStack>
                                        </Card>
                                        <Box background="bg-surface-selected" padding="200"></Box>
                                        <Card>
                                            <BlockStack gap={200}>
                                                <RangeInfoQuantity ranges={formState.ranges} returnRangeValue={updateRange} unsavedForm={unsavedForm} />
                                                {formError.ranges && (
                                                    <Text as="p" tone="critical">{formError.ranges}</Text>
                                                )}
                                            </BlockStack>
                                        </Card>
                                        <Box background="bg-surface-selected" padding="200"></Box>
                                        <Card>
                                            <BlockStack gap={200}>
                                                <InlineStack align="space-between">
                                                    <Text variant="headingSm">{ t("status") }</Text>
                                                    <Badge tone="warning">
                                                        <InlineStack gap={100}>
                                                            <Text variant="headingSm">{ t("total_active_discounts", {total: activeDiscounts, max: maxActiveDiscounts}) }</Text>
                                                            <Tooltip content={ t("maximum_active_discounts", {max: maxActiveDiscounts}) } dismissOnMouseOut>
                                                                <Icon source={QuestionCircleIcon} tone="base" />
                                                            </Tooltip>
                                                        </InlineStack>
                                                    </Badge>
                                                </InlineStack>
                                                <Divider />
                                                <Grid>
                                                    <Grid.Cell columnSpan={{ xs: 6, lg: 10 }}>
                                                        <InlineStack gap={600}>
                                                            {statusOptions.map((statusOption, index) => (
                                                                <RadioButton
                                                                    key={index}
                                                                    name="discount_status"
                                                                    id={statusOption.value}
                                                                    label={statusOption.label}
                                                                    checked={formState.status == statusOption.value}
                                                                    disabled={statusOption.value == "ACTIVE" && activeDiscounts >= maxActiveDiscounts}
                                                                    onChange={() => handleStatusChange(statusOption.value)}
                                                                />
                                                            ))}
                                                        </InlineStack>
                                                    </Grid.Cell>
                                                </Grid>
                                                {formError.status && (
                                                    <Text as="p" tone="critical">{formError.status}</Text>
                                                )}
                                            </BlockStack>
                                        </Card>
                                        <Box background="bg-surface-selected" padding="200"></Box>
                                        {formState.status == "SCHEDULED" && (<>
                                        <Card>
                                            <BlockStack gap={200}>
                                                <Text as="h1" variant="headingSm">{ t("active_dates") }</Text>
                                                <Divider />
                                                <Grid>
                                                    <Grid.Cell columnSpan={{ xs: 3, lg: 5 }} >
                                                        <DrDatePicker
                                                            currentValue={formState.start_date}
                                                            initialDate={initialStartDate}
                                                            label={ t("start_date") }
                                                            timezoneOffsetMinutes={timezoneOffsetMinutes}
                                                            onChange={handleStartDateChange}
                                                        />
                                                        {formError.start_date && (
                                                            <Text as="p" tone="critical">{formError.start_date}</Text>
                                                        )}
                                                    </Grid.Cell>
                                                    <Grid.Cell columnSpan={{ xs: 3, lg: 5 }}>
                                                        <DrTimePicker
                                                            currentValue={formState.start_time}
                                                            label={ t("start_time") }
                                                            initialTime={initialStartTime}
                                                            associatedDate={formState.start_date}
                                                            onChange={handleStartTimeChange}
                                                        />
                                                        {formError.start_time && (
                                                            <Text as="p" tone="critical">{formError.start_time}</Text>
                                                        )}
                                                    </Grid.Cell>
                                                </Grid>
                                                <Checkbox
                                                    label={ t("set_end_date_and_time") }
                                                    checked={formState.set_end_date_and_time}
                                                    onChange={handleSetEndTime}
                                                    disabled={!formState.start_date || !formState.start_time}
                                                />
                                                {formState.set_end_date_and_time == true && (
                                                    <Grid>
                                                        <Grid.Cell columnSpan={{ xs: 3, lg: 5 }}>
                                                            <DrDatePicker
                                                                currentValue={formState.end_date}
                                                                label={ t("end_date") }
                                                                initialDate={initialEndDate}
                                                                minDate={formState.end_date}
                                                                timezoneOffsetMinutes={timezoneOffsetMinutes}
                                                                onChange={handleEndDateChange}
                                                            />
                                                            {formError.end_date && (
                                                                <Text as="p" tone="critical">{formError.end_date}</Text>
                                                            )}
                                                        </Grid.Cell>

                                                        <Grid.Cell columnSpan={{ xs: 3, lg: 5 }}>
                                                            <DrTimePicker
                                                                currentValue={formState.end_time}
                                                                label={ t("end_time") }
                                                                initialTime={initialEndTime}
                                                                associatedDate={formState.end_date}
                                                                onChange={handleEndTimeChange}
                                                            />
                                                            {formError.end_time && (
                                                                <Text as="p" tone="critical">{formError.end_time}</Text>
                                                            )}
                                                        </Grid.Cell>
                                                    </Grid>
                                                )}
                                                {formState.set_end_date_and_time == true && (
                                                    <Box paddingBlockStart={200}>
                                                        <Text variant="bodySm" tone="subdued" alignment="end">*{ t("end_greater_than_start_message") }</Text>
                                                    </Box>
                                                )}
                                                <Text variant="bodySm" tone="subdued" alignment="end">*{ t("datetime_adjustment_message") }</Text>
                                            </BlockStack>
                                        </Card>
                                        <Box background="bg-surface-selected" padding="200"></Box>
                                        </>)}
                                        <Card>
                                            <BlockStack gap={200}>
                                                <Text variant="headingSm">{ t("customer_eligibility") }</Text>
                                                <Divider />
                                                <Grid>
                                                    <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                                                        <Grid>
                                                            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6, xl: 6 }} >
                                                                <BlockStack>
                                                                    {customerOptions.map((customerOption, index) => (
                                                                        <RadioButton
                                                                            key={index}
                                                                            name="customer"
                                                                            id={customerOption.id}
                                                                            label={customerOption.label}
                                                                            checked={formState.customer_eligibility == customerOption.id}
                                                                            onChange={handleCustomerTargetChange}
                                                                        />
                                                                    ))}
                                                                </BlockStack>
                                                            </Grid.Cell>
                                                        </Grid>
                                                    </Grid.Cell>
                                                </Grid>
                                                {formState.customer_eligibility != "all" && (
                                                    <BlockStack gap={200}>
                                                        <Grid>
                                                            <Grid.Cell columnSpan={{ xs: 5, lg: 10 }}>
                                                                <TextField
                                                                    type="text"
                                                                    placeholder={formState.customer_eligibility == "segment" ? t("search_by_customer_segment") : t("search_by_customer_email_or_tag")}
                                                                    autoComplete="off"
                                                                    prefix={<Icon source={SearchIcon} tone="base" />}
                                                                    onFocus={() => handleCustomerKeywordChange()}
                                                                />
                                                            </Grid.Cell>
                                                            <Grid.Cell columnSpan={{ xs: 1, lg: 1 }}>
                                                                <div className="flex full-height">
                                                                    <BlockStack align="end">
                                                                        <Button
                                                                            tone="critical"
                                                                            icon={SearchIcon}
                                                                            size="large"
                                                                            onClick={openCustomerSegmentModal}
                                                                        />
                                                                    </BlockStack>
                                                                </div>
                                                            </Grid.Cell>
                                                        </Grid>
                                                        {formError.segments && (
                                                            <Text as="p" tone="critical">{formError.segments}</Text>
                                                        )}
                                                        {formError.customers && (
                                                            <Text as="p" tone="critical">{formError.customers}</Text>
                                                        )}
                                                        {formState.customer_eligibility == "segment" && formState.segments && formState.segments.length > 0 && (
                                                            formState.segments.map((segment, index) => (
                                                                <SelectedItem
                                                                    key={index}
                                                                    target="segment"
                                                                    item={segment}
                                                                    removable={true}
                                                                    onItemRemove={removeSegment}
                                                                />
                                                            ))
                                                        )}
                                                        {formState.customer_eligibility == "customer" && formState.customers && formState.customers.length > 0 && (
                                                            formState.customers.map((customer, index) => (
                                                                <SelectedItem
                                                                    key={index}
                                                                    target="customer"
                                                                    item={customer}
                                                                    removable={true}
                                                                    onItemRemove={removeCustomer}
                                                                />
                                                            ))
                                                        )}
                                                    </BlockStack>
                                                )}
                                            </BlockStack>
                                        </Card>
                                    </Grid.Cell>

                                    <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 4, xl: 4 }}>
                                        <div className="large-device-summary">
                                            <Sticky>
                                                <Summary
                                                    title={formState.title}
                                                    applyType={formState.apply_type}
                                                    typeLength={
                                                        formState.apply_type == 'product' ? (formState.products.length) :
                                                        formState.apply_type == 'collection' ? (formState.collections.length) :
                                                        formState.apply_type == 'tag' ? (formState.include_tags.length) :
                                                        formState.apply_type == 'vendor' ? (formState.vendors.length) :
                                                        formState.apply_type == 'type' ? (formState.types.length) : 'All products'
                                                    }
                                                    rangeType={formState.quantity_range}
                                                    rowcount={formState.ranges.length}
                                                    status={formState.status}
                                                    startDate={formState.start_date}
                                                    startTime={formState.start_time}
                                                    endTimeChecked={formState.set_end_date_and_time}
                                                    endDate={formState.end_date}
                                                    endTime={formState.end_time}
                                                    customerType={formState.customer_eligibility}
                                                    customerOptionsLenght={
                                                        formState.customer_eligibility == "segment" ? formState.segments.length :
                                                        formState.customer_eligibility == "customer" ? formState.customers.length : t("all_customers")
                                                    }
                                                />
                                            </Sticky>
                                        </div>
                                    </Grid.Cell>
                                </Grid>
                                <Grid>
                                    <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 8, xl: 8 }}>
                                        <InlineStack align="end">
                                            <ButtonGroup>
                                                <Button tone="critical" onClick={() => openDeleteModal()} accessibilityLabel={ t("delete_discount") }>
                                                    { t("delete_discount") }
                                                </Button>
                                                <Button variant="primary" loading={formLoader} submit={true} accessibilityLabel={ t("save") }>
                                                    { t("save") }
                                                </Button>
                                            </ButtonGroup>
                                        </InlineStack>
                                    </Grid.Cell>
                                </Grid>
                                <Box padding={500}></Box>
                            </BlockStack>
                        )}
                    </Page>
                </Bleed>
            </form>
            {(customerSegmentModal && (formState.customer_eligibility == "segment" || formState.customer_eligibility == "customer")) && (
                <SelectionModal
                    showModal={customerSegmentModal}
                    target={formState.customer_eligibility}
                    parentKeyword={keyword}
                    preSelectedItems={formState.customer_eligibility == "customer" ? formState.customers : formState.segments}
                    getSelectedData={getSelectedData}
                    onCancel={closeCustomerSegmentModal}
                />
            )}
            {(rangesModal && formState.quantity_range == "preset") && (
                <SelectionRangeModal
                    showModal={rangesModal}
                    parentKeyword={rangeKeyword}
                    getSelectedRange={getSelectedRange}
                    onCancel={closeRangesModal}
                />
            )}

            <div className="small-device-summary">
                <Button variant="primary" tone="success" size="large" onClick={() => handleSummaryDisplay(true)} className="summaryBtn">{ t("summary") }</Button>
                <div className="summary">
                    {summary && (
                        <Summary
                            title={formState.title}
                            applyType={formState.apply_type}
                            typeLength={
                                formState.apply_type == 'product' ? (formState.products.length) :
                                formState.apply_type == 'collection' ? (formState.collections.length) :
                                formState.apply_type == 'tag' ? (formState.include_tags.length) :
                                formState.apply_type == 'vendor' ? (formState.vendors.length) :
                                formState.apply_type == 'type' ? (formState.types.length) : 'All products'
                            }
                            rangeType={formState.quantity_range}
                            rowcount={formState.ranges.length}
                            status={formState.status}
                            startDate={formState.start_date}
                            startTime={formState.start_time}
                            endTimeChecked={formState.set_end_date_and_time}
                            endDate={formState.end_date}
                            endTime={formState.end_time}
                            customerType={formState.customer_eligibility}
                            customerOptionsLenght={
                                formState.customer_eligibility == "segment" ? formState.segments.length :
                                formState.customer_eligibility == "customer" ? formState.customers.length : t("all_customers")
                            }
                            handleSummaryDisplay={handleSummaryDisplay}
                        />
                    )}
                </div>
            </div>

            <ui-modal id="delete-modal">
                <Box padding={400}>
                    <p>{ t("delete_discount_warning_message", {discount: formState.title}) }</p>
                </Box>
                <ui-title-bar title={ t("delete_discount_confirmation_message") }>
                    <button variant="primary" tone="critical" onClick={() => deleteDiscount()} disabled={deleteLoader}>{ t("yes_delete") }</button>
                    <button onClick={() => closeDeleteModal()} disabled={deleteLoader}>{ t("cancel") }</button>
                </ui-title-bar>
            </ui-modal>
        </BlockStack>
    );
}