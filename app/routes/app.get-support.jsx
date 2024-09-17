import { Link, useActionData, useNavigate, useParams, useSearchParams, useSubmit, useLoaderData } from "@remix-run/react";
import { Bleed, BlockStack, Box, Button, ButtonGroup, Card, Checkbox, Divider, Grid, Icon, InlineGrid, InlineStack, Page, RadioButton, Sticky, Text, TextField, Select, Pagination} from "@shopify/polaris";
import { ThumbsUpIcon, ArrowLeftIcon, SearchIcon, PlusCircleIcon, ChatIcon, ChevronDownIcon, ChevronUpIcon, PlusIcon } from "@shopify/polaris-icons";
import { useEffect, useState, useCallback } from "react";
import "../styles/global.css";
import { useTranslation } from "react-i18next";
import validator from "../libs/validator";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
export const loader = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const response = await admin.graphql(
        `#graphql
        query mainQuery {
            app {
                handle
            }
            shop {
                currencyCode
                myshopifyDomain
            }
        }`
    );
    const responseJson = await response.json();

    const shop = await prisma.shops.findFirst({
        where: {
            myshopifyDomain: responseJson.data.myshopifyDomain
        },
        select:{
            id:true
        }
    });

    const requested_features =  await prisma.featureRequests.findMany({
        select: {
            id: true,
            serial: true,
            title: true,
            description: true,
            postedBy: true,
            votes: true,
            createdAt: true,
        },
        where: {
            deletedAt: null,
        }
    });
    const faqs = await prisma.faqs.findMany({});
    return {
        target: "get-discounts",
        message: "Response data",
        data: responseJson.data || {},
        shop,
        requested_features,
        faqs
    };
};

export const action = async ({ request }) => {
    const formdata = await request.formData();
    const target = formdata.get('target');
    const title = formdata.get("title")||null;
    const description = formdata.get("description")||null;
    const postedBy = formdata.get("postedBy")||null;
    const shop = formdata.get("shop")||null;
    const current_shop_id = JSON.parse(shop).id;
    
    const selectedOrder = formdata.get("selectedOrder");
    
    let ordered_list = [];

    const orderControl = (requested_features)=>{
        if(selectedOrder=="less"){
            ordered_list = requested_features.sort((a, b) => a.votes.length - b.votes.length)
        }else if(selectedOrder=="most"){
            ordered_list = requested_features.sort((a, b) => b.votes.length - a.votes.length)
        }else if (selectedOrder == "oldest") {
            ordered_list = requested_features.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        } else if (selectedOrder == "latest") {
            ordered_list = requested_features.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        }
    }       

    try {
        // Setting the appropriate graphQl query for action depending on target
        if (description) {
            // Check if is action is for creating the discount
            if (target == "create-feature-request") {
                    await prisma.featureRequests.create({
                        data: {
                            shopId: current_shop_id,
                            status: "PENDING",
                            votes: [],
                            title,
                            description,
                            postedBy
                        }
                    });

                    return {
                        target: 'create-feature-request',
                        message: "Success",
                        toast: "The feature request will be published after approval, thanks!",
                       
                    };
                }   
                else {
                    return {
                        target: "error",
                        message: "create_requested_features_error",
                        data: [],
                    };
                }
            }
        else if(target == "vote-feature-request"){
            const selectedFeatureRequest = await prisma.featureRequests.findFirst({
                where: {
                    id: parseInt(formdata.get("selectedRequestId"))
                },
                select:{
                    votes: true
                }
            });
            
            const votes = Object.values(selectedFeatureRequest)[0]

            if(votes.includes(current_shop_id)){
                const filtered_out = votes.filter(id=>id!=current_shop_id);
                await prisma.featureRequests.update({
                    where: { id: parseInt(formdata.get("selectedRequestId")) },
                    data: { votes: filtered_out }
                }); 
            }else{
                votes.push(current_shop_id)
                await prisma.featureRequests.update({
                    where: { id: parseInt(formdata.get("selectedRequestId")) },
                    data: { votes: votes }
                }); 
            }

            const newPage = formdata.get("newPage") || 1;
            
            const skip = 4 * (parseInt(newPage) - 1);
    
            const requested_features = await prisma.featureRequests.findMany({
                orderBy: {
                    id: "asc",
                },
                skip: skip,
                take: 4,
            }); 
            orderControl(requested_features);
            return {
                message: "Vote completed",
                ordered_list
            }
        }     
        else if(target == "our-feature-requests") {
            const newPage = formdata.get("newPage") || 1;
            
            const skip = 4 * (parseInt(newPage) - 1);
    
            const ourArticles = await prisma.featureRequests.findMany({
                orderBy: {
                    id: "asc",
                },
                skip: skip,
                take: 4,
            });

            return {
                target: target,
                message: "Success",
                data: {
                    ourArticles: ourArticles
                }
            };
        }else if(target == "our-faqs") {
            const newPage = formdata.get("newPage") || 1;
            
            const skip = 3 * (parseInt(newPage) - 1);
    
            const faqs = await prisma.faqs.findMany({
                orderBy: {
                    id: "asc",
                },
                skip: skip,
                take: 3,
            });

            return {
                target: target,
                message: "Success",
                faqs
            };
        }
    } catch (err) {
        return {
            target: "error",
            message: "something_went_wrong",
            data: err,
        };
    }
};

export default function SupportPanel(){
    const { t } = useTranslation();
    const submit = useSubmit();
    const [headbackPage, setHeadbackPage] = useState("");
    const loaderData = useLoaderData();
    const [selectedOrder, setSelectedOrder] = useState('most');
    const [searchParams, setSearchParams] = useSearchParams();
    const shop  = loaderData?.shop;
    const [ourArticlesCount, setOurArticlesCount] = useState(loaderData?.requested_features.length);
    const [faqCount, setFaqCount] = useState(loaderData?.faqs.length)
    const [ourFeatureRequestsPage, setOurFeatureRequestsPage] = useState(1);
    const [faqPage, setFaqPage] = useState(1);
    const [requests, setRequests] = useState(loaderData?.requested_features.slice(0, 4))
    const [buttonId, setButtonId] = useState(null);

    const handleSelectedOrderChange = useCallback(
      (value) => setSelectedOrder(value),
      [],
    );
    
    const orderControl = () => {
        if (selectedOrder == "less") {
            setRequests(() => [...requests.sort((a, b) => a.votes.length - b.votes.length)]);
        } else if (selectedOrder == "most") {
            setRequests(() => [...requests.sort((a, b) => b.votes.length - a.votes.length)]);
        } else if (selectedOrder == "oldest") {
            setRequests(() => [...requests.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))]);
        } else if (selectedOrder == "latest") {
            setRequests(() => [...requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))]);
        }
    };
    
    useEffect(()=>{
        orderControl();
    }, [selectedOrder]);

    const options = [
        {label: 'Most voted', value: 'most'},
        {label: 'Less voted', value: 'less'},
        {label: 'Oldest', value: 'oldest'},
        {label: 'Latest', value: 'latest'}
    ];
    const [faqs, setFaqs] = useState(loaderData?.faqs.slice(0, 3));
    
    
    const [selected, setSelected] = useState(null);
    
    const handleToggle = (id) => { 
        setSelected(id);
    };
    
    useEffect(() => { 
        if(searchParams.get("headback")) {
            if(searchParams.get("headback") == "home") {
                setHeadbackPage("HP");
            }
            else if(searchParams.get("headback") == "new") {
                setHeadbackPage("NO");
            }
        }
        else {
            setHeadbackPage("AD");
        }
    }, []);
    const [formLoader, setFormLoader] = useState(false);
    const [formState, setFormState] = useState({
        title: "",
        description: "", 
        postedBy: ""
    });
  
    const discardForm = () => {
        setFormState({
            title: "",
            description: "", 
            postedBy: ""
        });
    }

    const discardVoteForm = () => {
        setFormState({
            title: "",
            quantity_range: "new",
            ranges: [],
            start_date: "",
        
        });
    }

    const validateIndividualField = ({fieldName, fieldValue, secondaryFieldName = "", secondaryFieldValue = ""}) => {
        const validate = validator({
            [fieldName]: fieldValue,
            [secondaryFieldName]: secondaryFieldValue
        }, {
            [fieldName]: fieldName == "title" ? "string"
                       : fieldName == "description" ? "required"
                        :fieldName == "postedBy"? "string"
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

    const [formSubmitted, setFormSubmitted] = useState(false);
     // Update title
    const handleTitleChange = (newValue) => {
        setFormState({ ...formState, title: newValue });
        if(formSubmitted) {
            validateIndividualField({fieldName: "title", fieldValue: newValue});
        }
    };

    const handleDescriptionChange = (newValue) => {
        setFormState({ ...formState, description: newValue });
        if(formSubmitted) {
            validateIndividualField({fieldName: "description", fieldValue: newValue});
        }
    };

    const handlePostedByChange = (newValue) => {
        setFormState({ ...formState, postedBy: newValue });
        if(formSubmitted) {
            validateIndividualField({fieldName: "postedBy", fieldValue: newValue});
        }
    };

    const submitForm = async () => {
        setFormSubmitted(true);
        // First take the submit button to loading state, so that accidental multiple clicks cannot happen
        setFormLoader(true);
        // Validate title
        const validate = validator(formState, {
            title: "string",
            description: "required|string|minLength:5|maxLength:100",
            postedBy: "string"
        });
        // If error found show error
        if (validate.error) { 
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
            submit({
                target: "create-feature-request",
                shop: JSON.stringify(shop),
                title:formState.title,
                description:formState.description,
                postedBy:formState.postedBy,
                selectedOrder,
                newPage: ourFeatureRequestsPage 
            }, { method: "POST" });
           
        }
    };

    const [formError, setFormError] = useState({
        title: "",
        description: "",
        postedBy: ""
    });
    const [selectedRequestId, setSelectedRequestId] = useState(null);

    const submitVoteForm = async () => {
        // First take the submit button to loading state, so that accidental multiple clicks cannot happen
        submit({
            target: "vote-feature-request",
            shop:JSON.stringify(shop),
            selectedRequestId,
            selectedOrder,
            newPage: ourFeatureRequestsPage
        }, { method: "POST" });
    };
    
    const requestListGen = ()=>{
        return(
            <form onSubmit={(e) => { e.preventDefault(); submitVoteForm();}} onReset={discardVoteForm}>
                <BlockStack gap={300}>
                    {
                        requests.map(request => 
                            <Card roundedAbove="sm" key={request.id} background="bg-surface">
                                <InlineGrid columns={['twoThirds', 'oneThird']}>
                                    <Text variant="headingLg" as="h5">
                                        {request.title}
                                    </Text>
                                    <Box color="bg-surface-info-active">
                                        <InlineStack align="end">
                                            <Box>
                                                <Button size="micro" variant="plain" submit={true} onClick={()=>setSelectedRequestId(request.id)}>
                                                    <Icon source={ThumbsUpIcon} tone={request.votes.find(id => id == shop.id)?"info":"base"} />
                                                </Button>
                                            </Box>
                                            <Box paddingInlineStart={10}>
                                               <Button disabled variant="plain" size="large">
                                                    <Text tone="success"> | {request.votes.length} </Text>
                                                </Button>  
                                            </Box>
                                        </InlineStack>
                                        
                                        {/* {request.votes.find(id => id == shop.id) ? <Button submit={true} onClick={()=>setSelectedRequestId(request.id)} icon={ChevronDownIcon} size="large" fullWidth>Down vote({request.votes.length})</Button> : <Button submit={true} onClick={()=>setSelectedRequestId(request.id)} icon={ChevronUpIcon} size="large" fullWidth variant="primary" tone="success">Up vote({request.votes.length})</Button>} */}
                                    </Box>
                                </InlineGrid>
                                <Text as="p" fontWeight="regular" variant="bodyLg">
                                    {request.description}
                                </Text>
                                <hr></hr>
                                <Text>Posted by: <strong>{request.postedBy?request.postedBy:"annonymous"}</strong></Text>
                            </Card>
                        )
                    }
                </BlockStack>
            </form>
        )
    };
    
    const actionData = useActionData() || {};
    
    useEffect(()=>{ 
        if (actionData.target == "create-feature-request" && actionData.message=="Success") { 
            if(formLoader) {
                setFormLoader(false);
            }
            setFormState({
                title: "",
                description: "", 
                postedBy: ""
            });
            shopify.toast.show(t(actionData.toast), { isError: false });
           
        }else if(actionData.message=="Vote completed"){
            setRequests(()=>[...actionData.ordered_list]);
        }
        else if(actionData?.target == "our-feature-requests" && actionData?.data?.ourArticles) {
            setRequests(actionData?.data?.ourArticles);
        }
        else if(actionData?.target == "our-faqs"){ 
            setFaqs(actionData?.faqs)
        }
    },[actionData]);


    const getPaginatedFeatureRequests = (direction) => { 
        
        const newPage = direction == "next" ? ourFeatureRequestsPage + 1 : ourFeatureRequestsPage - 1;
        
        setOurFeatureRequestsPage(newPage);

        submit({
            target: "our-feature-requests",
            shop: JSON.stringify(shop),
            newPage: newPage,
        }, { method: "POST" });
    }

    const getPaginatedFaqs = (direction) => { 
        
        const newPage = direction == "next" ? faqPage + 1 : faqPage - 1;
        
        setFaqPage(newPage);

        submit({
            target: "our-faqs",
            shop: JSON.stringify(shop),
            newPage: newPage,
        }, { method: "POST" });
    }

    const [isMailtoSupported, setIsMailtoSupported] = useState(true);

    useEffect(() => { 
      const handleMailtoClick = (event) => { 
        // Use setTimeout to check if email client opens after a short delay
        setTimeout(() => { 
          if (!document.hasFocus()) { 
            // If the document loses focus, it might mean the email client did not open
            setIsMailtoSupported(false);
          }
        }, 1000);
      };
  
      const mailtoLink = document.querySelector('a[href^="mailto:"]');
      
      if (mailtoLink) { 
        mailtoLink.addEventListener('click', handleMailtoClick);
  
        // Clean up the event listener on component unmount
        return () => {
          mailtoLink.removeEventListener('click', handleMailtoClick);
        };
      }
    }, []);

    const handleEmailUsButton = ()=>{
        setButtonId(4); 
        if(isMailtoSupported==true){  
            setTimeout(() => { 
            if (document.hasFocus()) { 
                // If the document loses focus, it might mean the email client did not open
                shopify.toast.show("Our email: support@efoli.com", { isError: true, duration: 12000 });
            }
            }, 2000);
        }
    }

    return (
        <>  
            <Box padding="600">
                <InlineStack gap="400">
                            {headbackPage == "HP" && (
                                <InlineStack blockAlign="center" gap="200">
                                <Link to="/app">
                                    <Button icon={ArrowLeftIcon} size="large" />
                                </Link>
                                <Text>Dashboard</Text>
                                </InlineStack>
                                
                            )}
                            {headbackPage == "NO" && (
                                <InlineStack blockAlign="center" gap="200">
                                    <Link to="/app/new-offer">
                                        <Button icon={ArrowLeftIcon} size="large" />
                                    </Link>
                                    <Text>New offer</Text>
                                </InlineStack>
                                
                            )}
                            {headbackPage == "AD" && (
                                <InlineStack blockAlign="center" gap="200">
                                    <Link to="shopify://admin/discounts" target="_top">
                                        <Button icon={ArrowLeftIcon} size="large" />
                                    </Link>
                                    <Text>Add discounts</Text>
                                </InlineStack>
                            )}
                </InlineStack >
            </Box>
              
            <Page>
                <BlockStack gap={600}>
                    <BlockStack inlineAlign="center">
                        <Box background="bg-surface-selected" padding="200"></Box>
                        <Text variant="heading2xl">Need our support?</Text>
                    </BlockStack>
                    
                    {/* first row of top svg icon block*/}
                    <Grid>
                        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
                            <Card padding={600} background={buttonId!=null && buttonId==1 ? "bg-surface-critical-active" : "bg-surface-secondary"} >
                                <BlockStack gap={400} inlineAlign="start">
                                    <img
                                        src="/images/support/live_chat.svg"
                                        width={54}
                                        height={54}
                                        alt="Live Chat Support"
                                    />
                                    <Box paddingBlock={50} />
                                    <Text variant="headingLg" as="h5">
                                        Live Chat Support
                                    </Text>
                                    <Text variant="bodyLg" as="p">
                                        Need quick assistance? Chat live <br></br> with our expert support team and <br /> get instant solutions.
                                    </Text>
                                    <Button onClick={()=> setButtonId(1)} id="1" size="large">Start Chat</Button>
                                </BlockStack>
                            </Card>
                        </Grid.Cell>

                        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
                            <Card padding={600} background={buttonId!=null && buttonId==2 ? "bg-surface-critical-active" : "bg-surface-secondary"} >
                                <BlockStack gap={400} inlineAlign="start">
                                    <img
                                        src="/images/support/call.svg"
                                        width={54}
                                        height={54}
                                        alt="Call Schedule"
                                    />
                                    <Box paddingBlock={50} />
                                    <Text variant="headingLg" as="h5">
                                        Call Schedule
                                    </Text>
                                    <Text variant="bodyLg" as="p">
                                        Prefer to talk? Schedule a call with <br></br>our technical experts at your <br /> convenience.
                                    </Text>
                                    <Button onClick={()=> setButtonId(2)} id="2" size="large">Book a Call</Button>
                                </BlockStack>
                            </Card>
                        </Grid.Cell>

                        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
                            <Card padding={600} background={buttonId!=null && buttonId==3 ? "bg-surface-critical-active" : "bg-surface-secondary"} >
                                <BlockStack gap={400} inlineAlign="start">
                                    <img
                                        src="/images/support/ticket.svg"
                                        width={54}
                                        height={54}
                                        alt="Create a Ticket"
                                    />
                                    <Box paddingBlock={50} />
                                    <Text variant="headingLg" as="h5">
                                        Create a Ticket
                                    </Text>
                                    <Text variant="bodyLg" as="p">
                                        Got an issue? Submit a support <br /> ticket, and we'll prioritize <br /> resolving your request.
                                    </Text>
                                    <Button onClick={()=> setButtonId(3)} id="3" size="large" url={`/app/tickets`}>
                                        Create Support Ticket
                                    </Button>
                                </BlockStack>
                            </Card>
                        </Grid.Cell>
                       
                    </Grid>
                    {/* second row of top svg icon block*/}
                    <Grid>
                    <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
                            <Card padding={600} background={buttonId!=null && buttonId==4 ? "bg-surface-critical-active" : "bg-surface-secondary"} >
                                <BlockStack gap={400} inlineAlign="start">
                                    <img
                                        src="/images/support/email.svg"
                                        width={54}
                                        height={54}
                                        alt="Email support"
                                    />
                                    <Box paddingBlock={50} />
                                    <Text variant="headingLg" as="h5">
                                        Email support
                                    </Text>
                                    <Text variant="bodyLg" as="p">
                                        Need detailed assistance? Reach <br /> out via email, and we'll get back to <br /> you promptly.
                                    </Text>
                                    <Button onClick={handleEmailUsButton} id="4" size="large" url="mailto:support@efoli.com" target="_blank">Email Us</Button>
                                </BlockStack>
                            </Card>
                        </Grid.Cell>

                        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
                            <Card padding={600} background={buttonId!=null && buttonId==5 ? "bg-surface-critical-active" : "bg-surface-secondary"} >
                                <BlockStack gap={400} inlineAlign="start">
                                    <img
                                        src="/images/support/youtube.svg"
                                        width={54}
                                        height={54}
                                        alt="Youtube Tutorials"
                                    />
                                    <Box paddingBlock={50} />
                                    <Text variant="headingLg" as="h5">
                                        Youtube Tutorials
                                    </Text>
                                    <Text variant="bodyLg" as="p">
                                        Discover our wide range of video <br /> tutorials created to assist you in <br /> creating discounts.
                                    </Text>
                                    <Button onClick={()=> setButtonId(5)} id="5" size="large">Request Now</Button>
                                </BlockStack>
                            </Card>
                        </Grid.Cell>

                        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
                            <Card padding={600} background={buttonId!=null && buttonId==6 ? "bg-surface-critical-active" : "bg-surface-secondary"} >
                                <BlockStack gap={400} inlineAlign="start">
                                    <img
                                        src="/images/support/help.svg"
                                        width={54}
                                        height={54}
                                        alt="Help Docs"
                                    />
                                    <Box paddingBlock={50} />
                                    <Text variant="headingLg" as="h5">
                                        Help Docs
                                    </Text>
                                    <Text variant="bodyLg" as="p">
                                        Explore our in-depth help <br></br> documentation for step-by-step <br /> guidance and solutions.
                                    </Text>
                                    <Button onClick={()=> setButtonId(6)} id="6" size="large">Request Now</Button>
                                </BlockStack>
                            </Card>
                        </Grid.Cell>
                    </Grid>
                    
                     {/* Social media block */}
                    <BlockStack gap={600}>
                        <Box paddingBlockStart={600}></Box>
                        <InlineStack align="center">
                            <Text variant="headingXl" as="h4">
                                Unlock Opportunities Through Connections
                            </Text>
                        </InlineStack>
                        <InlineStack align="space-between" gap={100}>
                            <Card padding={800}>
                                <BlockStack gap={400} inlineAlign="center">
                                    <img
                                        src="/images/support/facebook.svg"
                                        width={40}
                                        height={40}
                                        alt="Facebook"
                                    />
                                    <Box minWidth="6rem">
                                        <Text alignment="center" variant="headingLg" as="h5">Facebook</Text>
                                    </Box>
                                </BlockStack>
                            </Card>
                            <Card padding={800}>
                                <BlockStack gap={400} inlineAlign="center">
                                    <img
                                        src="/images/support/x.svg"
                                        width={40}
                                        height={40}
                                        alt="X"
                                    />
                                    <Box minWidth="6rem">
                                        <Text alignment="center" variant="headingLg" as="h5">X</Text>
                                    </Box>
                                </BlockStack>
                            </Card>
                            <Card padding={800}>
                                <BlockStack gap={400} inlineAlign="center">
                                    <img
                                        src="/images/support/instagram.svg"
                                        width={40}
                                        height={40}
                                        alt="Instagram"
                                    />
                                    <Box minWidth="6rem">
                                        <Text alignment="center" variant="headingLg" as="h5">Instagram</Text>
                                    </Box>
                                </BlockStack>
                            </Card>
                            <Card padding={800}>
                                <BlockStack gap={400} inlineAlign="center">
                                    <img
                                        src="/images/support/linkedin.svg"
                                        width={40}
                                        height={40}
                                        alt="LinkedIn"
                                    />
                                    <Box minWidth="6rem">
                                        <Text alignment="center" variant="headingLg" as="h5">LinkedIn</Text>
                                    </Box>
                                </BlockStack>
                            </Card>
                            <Card padding={800}>
                                <BlockStack gap={400} inlineAlign="center">
                                    <img
                                        src="/images/support/pinterest.svg"
                                        width={40}
                                        height={40}
                                        alt="Pinterest"
                                    />
                                    <Box minWidth="6rem">
                                        <Text alignment="center" variant="headingLg" as="h5">Pinterest</Text>
                                    </Box>
                                </BlockStack>
                            </Card>
                        </InlineStack>
                        <Box paddingBlockEnd={600}></Box>
                    </BlockStack>
                    
                    {/* FAQ section*/}
                    <Card>
                        <BlockStack gap={500}>
                            <BlockStack gap={100}>
                                <Box paddingBlockEnd={600}></Box>
                                <InlineStack align="center">
                                    <Text alignment="center" variant="headingXl">
                                        Frequently Asked Questions
                                    </Text>
                                </InlineStack>
                            
                                <InlineStack align="center" >
                                    <Text alignment="center" variant="bodyLg" as="p">
                                        Have a question?  <b> We've got answers! </b> This FAQ section is designed to address <br></br> some of the most common inquiries we receive.
                                    </Text>
                                </InlineStack>
                            
                            </BlockStack>
                            <BlockStack>
                                <Box padding={600}>
                                {
                                    faqs.map(content=>{ 
                                        let background_color =  selected==content.id ? "bg-surface-critical": "";
                                        return(
                                                <Box padding="600" key={content.id} background={background_color} onClick={() => handleToggle(content.id)}>
                                                    <BlockStack 
                                                        as="div"
                                                        onClick={() => handleToggle(content.id)}
                                                    >
                                                        <InlineStack align="space-between">
                                                            <Text variant="headingMd" as="h6">{content.title}</Text>
                                                            <Text variant="bodyLg" as="p">
                                                                {selected==content.id ? <Icon source={ChevronUpIcon}></Icon>:<Icon source={ChevronDownIcon}></Icon>}
                                                            </Text>
                                                        </InlineStack>
                                                    </BlockStack>
                                                    {selected == content.id && <Text>{content.description}</Text>}
                                                </Box>
                                        )
                                        }
                                    )
                                }
                                </Box>
                                <Box paddingBlock={200}>
                                    <InlineStack align="center">
                                        <Pagination
                                            hasPrevious
                                            previousTooltip="Previous"
                                            onPrevious={() => faqPage > 1 ? getPaginatedFaqs("previous") : {}}
                                            
                                            hasNext
                                            nextTooltip="Next"
                                            onNext={() => (Math.ceil(faqCount / 4) > faqPage) ? getPaginatedFaqs("next") : {}}
                                        />
                                    </InlineStack>
                                </Box>
                            </BlockStack>
                            <InlineStack align="center">
                                <Box background="bg-surface-emphasis-hover" padding="200" borderRadius="200">
                                    <InlineStack gap="100"><Text>Didn’t find the answer you are looking for?</Text><Link> <Text> Contact our support </Text></Link> | <Link> Create a Ticket </Link> </InlineStack>
                                </Box>
                            </InlineStack>
                        </BlockStack>
                        <Box paddingBlockEnd={600}></Box>
                    </Card>

                    <Grid>
                        {/* Feature request list*/}
                        <Grid.Cell columnSpan={{xs: 6, sm: 8, md: 8, lg: 8, xl: 8}}>
                            <Box borderRadius="200" background="bg-fill-active" padding="300">
                                <BlockStack gap={400}>
                                    <InlineGrid columns={2}>
                                        <Text as="h1" variant="headingXl">Feature Requests</Text>
                                        <Select
                                            options={options}
                                            onChange={handleSelectedOrderChange}
                                            value={selectedOrder}
                                        />
                                    </InlineGrid>
                                    
                                    {requestListGen()}

                                    <Box paddingBlock={200}>
                                        <InlineStack align="center">
                                            <Pagination
                                                hasPrevious
                                                previousTooltip="Previous"
                                                onPrevious={() => ourFeatureRequestsPage > 1 ? getPaginatedFeatureRequests("previous") : {}}
                                                
                                                hasNext
                                                nextTooltip="Next"
                                                onNext={() => (Math.ceil(ourArticlesCount / 4) > ourFeatureRequestsPage) ? getPaginatedFeatureRequests("next") : {}}
                                            />
                                        </InlineStack>
                                    </Box>
                                </BlockStack>
                            </Box>
                        </Grid.Cell>
                        {/* Feature request create form */}
                        <Grid.Cell columnSpan={{xs: 6, sm: 4, md: 4, lg: 4, xl: 4}}>
                            <Box background="bg-fill-active" padding="200"  borderStartStartRadius="150" borderStartEndRadius="150">
                                <Text variant="headingMd" as="h3">
                                    Request for a feature
                                </Text>
                                <Text as="h4">
                                    Share your ideas for new features and enhancements!
                                </Text>
                            </Box>
                            <Box background="bg-surface" padding="200">
                            <form data-save-bar data-discard-confirmation onSubmit={(e) => { e.preventDefault(); submitForm() }} onReset={discardForm}>
                                <Grid>
                                    <Grid.Cell columnSpan={{ xs: 6, sm: 12, md: 12, lg: 12, xl: 12 }}>
                                        <BlockStack>
                                            <Grid>
                                                <Grid.Cell columnSpan={{ xs: 6, sm: 12, md: 12, lg: 12, xl: 12 }}>
                                                    <Text as="h1" variant="headingSm">Title(Optional)</Text>
                                                    <Text>
                                                    Brief title or summary of the feature you're requesting (e.g., "Integration with XYZ Service")
                                                    </Text>
                                                    <TextField
                                                        type="text"
                                                        placeholder="Add a short title"
                                                        name="title"
                                                        value={formState.title}
                                                        onChange={handleTitleChange}
                                                        
                                                    
                                                        showCharacterCount
                                                    />
                                                </Grid.Cell>

                                                <Grid.Cell columnSpan={{ xs: 6, sm: 12, md: 12, lg: 12, xl: 12 }}>
                                                    <Text as="h1" variant="headingSm">Description</Text>
                                                    <Text>
                                                        Describe what you'd love to see and how it would help you. Your input is valuable and helps us create solutions that truly meet your needs.
                                                    </Text>
                                                    <TextField
                                                        type="text"
                                                        placeholder="Describe the feature you'd like to see"
                                                        name="description"
                                                        value={formState.description}
                                                        onChange={handleDescriptionChange}
                                                        multiline={4}
                                                        maxLength={100}
                                                        showCharacterCount
                                                    />
                                                </Grid.Cell>

                                                <Grid.Cell columnSpan={{ xs: 6, sm: 12, md: 12, lg: 12, xl: 12 }}>
                                                    <Text as="h1" variant="headingSm">Posted by(Optional)</Text>
                                                    <Text>
                                                        We kindly ask for your email address so that we can stay in touch if we have any questions or updates 
                                                    </Text>
                                                    <TextField
                                                        type="text"
                                                        placeholder="Write your name"
                                                        name="postedBy"
                                                        value={formState.postedBy}
                                                        onChange={handlePostedByChange}
                                                        
                                                        maxLength={100}
                                                        showCharacterCount
                                                    />
                                                </Grid.Cell>

                                                <Grid.Cell columnSpan={{ xs: 6, sm: 12, md: 12, lg: 12, xl: 12 }}>
                                                    <Button fullWidth variant="primary" loading={formLoader} submit={true} accessibilityLabel={ t("save") }>
                                                        Request
                                                    </Button>
                                                </Grid.Cell>    
                                                
                                            </Grid>
                                            {
                                                formError.title && (
                                                    <Text as="p" tone="critical">{formError.title}</Text>
                                                )
                                            }
                                        </BlockStack>
                                    </Grid.Cell>
                                </Grid>
                            </form>
                            </Box>
                            <Box background="bg-surface" padding="200"  borderEndStartRadius="150" borderEndEndRadius="150">
                                
                            </Box>
                        </Grid.Cell>
                    </Grid>
                </BlockStack>
            </Page>
        </>
    );
}