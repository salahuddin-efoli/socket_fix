import { InlineStack, Card, BlockStack, Bleed, Page, Divider, Button, IndexTable, Box, Spinner, InlineGrid, SkeletonBodyText, SkeletonDisplayText, SkeletonTabs, ButtonGroup } from '@shopify/polaris';
import { PlusIcon, XIcon, AlertBubbleIcon } from "@shopify/polaris-icons";
import { useState, useEffect, useContext, useMemo } from 'react';
import { useTranslation } from "react-i18next";
import { useSubmit, useLoaderData, useActionData } from '@remix-run/react';
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import TicketDetailsCard from '../components/TicketDetailsCard';
import TicketCreateCard from '../components/TicketCreateCard';
import {notificationContext} from '../contexts/notificationContext';
import newTicketIdContext from '../contexts/newTicketIdContext';
import sendMail from '../sendMail';
import  {io} from "socket.io-client";
export const loader = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const response = await admin.graphql(
        `#graphql
        query mainQuery {
            shop {
                myshopifyDomain
                name
            }
        }`
    );
    const responseJson = await response.json();

    const shopInfo = await prisma.shops.findFirst({
		select: {
            id: true,
            name: true,
            email: true,
        },
		where: {
			myshopifyDomain: responseJson.data.shop.myshopifyDomain,
		},
	});

    const tickets = await prisma.tickets.findMany({
        where: {
            shopId: shopInfo.id
        },
        orderBy: {
            id: "desc"
        }
    })

    return {
        target: "ticketsList",
        message: "Success",
        data: {
            shopInfo: shopInfo,
            tickets: tickets || [],
        }
    };
};

export const action = async ({ request }) => {
    const formdata = await request.formData();
    const target = formdata.get("target");
    const ticketId = formdata.get("ticketId") || "";

    try {
        // Find the support agent with fewest amount of opened tickets
        const supportAgents = await prisma.supportAgents.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                _count: {
                    select: {
                        tickets: { where: { status: "OPEN" } }
                    }
                }
            },
            orderBy: {
                tickets: {
                    _count: "asc"
                }
            },
            where: {
                status: "ACTIVE",
                role: "AGENT"
            },
            take: 1
        });
        if (target == "create-ticket") {
            const shopId = formdata.get("shopId");
            const email = formdata.get("email");
            const subject = formdata.get("subject");
            const message = formdata.get("message");

            if(supportAgents && supportAgents.length > 0) {
                const ticketSlug = "DRT" + shopId + Date.now();
                const ticket = await prisma.tickets.create({
                    data: {
                        slug: ticketSlug,
                        shopId: parseInt(shopId),
                        shopEmail: email,
                        supportAgentId: supportAgents[0]?.id,
                        subject: subject,
                    }
                });
                if(ticket) {
                    await prisma.ticketReplies.create({
                        data: {
                            ticketId: ticket.id,
                            replyFrom: "MERCHANT",
                            message: message,
                        }
                    });
                    // Mail send to the support agent for a new ticket
                    sendMail({
                        toMail: supportAgents[0]?.email,
                        subject: subject,
                        mailData: {
                            name: supportAgents[0]?.name,
                            body: `Merchant create a ticket and waiting for your response. please replay this marchant TicketId is ${ticketSlug} and url is
                                 ${process.env.VITE_SHOPIFY_APP_URL}/support/ticket/${ticketSlug}`
                        }
                    })

                    return {
                        target: target,
                        message: "Success",
                        data: ticket,
                        id: ticket.id
                    }
                }
                else {
                    return {
                        target: "error",
                        message: "could_not_create_ticket",
                    }
                }
            }
            else {
                return {
                    target: "error",
                    message: "could_not_create_ticket",
                }
            }
        }
        else if (target == "ticket-replies") {
            const ticketDetails = await prisma.tickets.findFirst({
                include: {
                    ticketReplies: {
                        select: {
                            id: true,
                            supportAgentId: true,
                            replyFrom: true,
                            message: true,
                            createdAt: true,
                            supportAgent: {
                                select: { id: true, name: true, role: true }
                            }
                        }
                    },
                    shop: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                where: {
                    id: parseInt(ticketId)
                }
            });

            // Mail send to the support agent for a new replay
            sendMail({
                toMail: supportAgents[0]?.email,
                subject: "You have a new replay from marchant",
                mailData: {
                    name: supportAgents[0]?.name,
                    body: `Merchant create a ticket and waiting for your response. please replay this marchant . TicketId is ${ticketDetails?.slug} and url is
                         ${process.env.VITE_SHOPIFY_APP_URL}/support/ticket/${ticketDetails?.slug}`
                  }
            })

            return {
                target: target,
                message: "Success",
                data: {
                    ticketDetails: ticketDetails
                },
            }
        }
        else if (target == "status-update") {
            const status = formdata.get("status");
            const updatedTicket = await prisma.tickets.update({
                where: { id: parseInt(ticketId) },
                data: {
                    status: status
                }
            });

            return {
                target: target,
                message: "Success",
                data: {
                    updatedTicket: updatedTicket
                },
            }
        }
        else if (target == "create-reply") {
            const message = formdata.get("message");
            const newReply = await prisma.ticketReplies.create({
                data: {
                    ticketId: parseInt(ticketId),
                    replyFrom: "MERCHANT",
                    message: message,
                }
            });

            return {
                target: target,
                message: "Success",
                data: {
                    newReply: newReply
                },
            }
        }
    } catch (err) {
		return {
			target: "error",
			message: "something_went_wrong",
			data: err,
		};
	}
}

export default function Tickets() {
    const loaderData = useLoaderData();
    const actionData = useActionData();
    const submit = useSubmit();
    const { t } = useTranslation();

    const [pageLoader, setPageLoader] = useState(true);
    const [openTicketCreateCard, setOpenTicketCreateCard] = useState(false);
    const [openTicketRepliesCard, setOpenTicketRepliesCard] = useState(false);
    const [selectedTab, setSelectedTab] = useState(0);
    const [shopInfo, setShopInfo] = useState();

    const initialTickets = [ ...loaderData.data.tickets ];
    const [tickets, setTickets] = useState([]);
    const [ticketDetails, setTicketDetails] = useState(null);
    
    const { notification, setNotification } = useContext(notificationContext);
    const {id, setId} = useContext(newTicketIdContext);
    
    const resourceName = {
        singular: 'ticket',
        plural: 'tickets',
    };

    const handleTabChange = (index) => {
        setSelectedTab(index);
        setOpenTicketCreateCard(false);
        setOpenTicketRepliesCard(false);
        setTicketDetails(null);
        // After tab change, set appropriate ticket list for that specific tab
        setTickets(categorizedTickets(index));
    };

    const categorizedTickets = (index) => {
        if(index == 0) {
            return initialTickets.filter(ticket => (ticket.status == "PENDING" || ticket.status == "OPEN"));
        }
        else if(index == 1) {
            return initialTickets.filter(ticket => ticket.status == "SOLVED");
        }
        else if(index == 2) {
            return initialTickets.filter(ticket => ticket.status == "CANCELED");
        }
    }
  
    const toggleTicketDetails = (ticketId) => {
        //clear this ticket from notification arr
        const filtered_notifications = notification.filter(item=>item!=ticketId);
        setNotification(filtered_notifications);
        //this ticket gets removed from localstorage
        window.localStorage.setItem("ticketIds", JSON.stringify(filtered_notifications));
        // Now, if ticketId exists, then call action
        if(ticketId) {
            setOpenTicketRepliesCard(true);
            submit({ target: "ticket-replies", ticketId: ticketId }, { method: "POST" });
        }
        else {
            setOpenTicketRepliesCard(false);
            setTicketDetails(null);
        }
    };

    useEffect(() => {
        if(loaderData && loaderData.target == "ticketsList" && loaderData.message == "Success") {
            if(loaderData?.data?.shopInfo) {
                setShopInfo(loaderData.data.shopInfo);
            }
            if(initialTickets.length > 0) {
                // As the Open tab is opened by default, we have to set opened ticket list for this tab
                setTickets(categorizedTickets(0));
            }
  
            if(pageLoader) {
                setPageLoader(false);
            }
        }
  
      }, []);

    //socket.io related section start
    const [socket, setSocket] = useState();
     useEffect(() => {
        const socket = io("wss://socket.efoli.com/socket.io", {

           reconnectionDelayMax: 10000
        });
        setSocket(socket);
        // Cleanup function
        return () => {
            socket.disconnect();
        };
    }, []);
    //socket.io section ends
    useEffect(() => {
        if(actionData) {
            if(actionData.target == "error") {
                shopify.toast.show(t(actionData.message), { isError: true });
            }
            else if (actionData.target == "ticket-replies" && actionData.message == "Success" && actionData.data?.ticketDetails?.id) {
                if(ticketDetails == null) {
                    setTicketDetails(actionData.data.ticketDetails);
                }
            }
            else if (actionData.target == "status-update" && actionData.message == "Success" && actionData.data?.updatedTicket?.id) {
                const updatedInitialTicket = initialTickets.find(ticket => ticket.id === actionData.data?.updatedTicket?.id);
                updatedInitialTicket.status = actionData.data?.updatedTicket?.status;

                if(actionData.data?.updatedTicket?.status == "OPEN") {
                    handleTabChange(0);
                }
                else if(actionData.data?.updatedTicket?.status == "SOLVED") {
                    handleTabChange(1);
                }
                else if(actionData.data?.updatedTicket?.status == "CANCELED") {
                    handleTabChange(2);
                }
            }
            else if (actionData.target == "create-ticket" && actionData.message == "Success" && actionData.data?.id) {
                initialTickets.unshift(actionData.data);
                handleTabChange(0);
                setId((prevId) => {return actionData.id} );
                socket?.emit("newTicketInMerchant", {id:actionData.id, ticket: actionData.data});
            }
        }
	}, [actionData]);
    
    useEffect(()=>{ 
        if(notification != null) {
            if(notification.length>0) window.localStorage.setItem("ticketIds", JSON.stringify(notification));
        }
    },[notification])

    useEffect(()=>{
        if(JSON.parse(window.localStorage.getItem("ticketIds"))) {
            setNotification(JSON.parse(window.localStorage.getItem("ticketIds")));
        }
    },[])

    const showNotificationIcon = useMemo(() => { 
        const ticketIds = categorizedTickets(selectedTab).map(ticket => ticket.id);
        return ticketIds.some(id => notification.includes(id));
    }, [selectedTab, notification]);

    return (
        <Bleed>
            <Page fullWidth>
                <Card>
                    <BlockStack gap={300}>
                        <InlineStack align="space-between">
                            <ButtonGroup>
                                {showNotificationIcon?
                                <Button variant="tertiary" pressed={selectedTab == 0} onClick={() => handleTabChange(0)} icon={AlertBubbleIcon}>{ t('opened') }</Button>
                                :
                                <Button variant="tertiary" pressed={selectedTab == 0} onClick={() => handleTabChange(0)}>{ t('opened') }</Button>
                                }
                                <Button variant="tertiary" pressed={selectedTab == 1} onClick={() => handleTabChange(1)}>{ t('solved') }</Button>
                                <Button variant="tertiary" pressed={selectedTab == 2} onClick={() => handleTabChange(2)}>{ t('canceled') }</Button>
                            </ButtonGroup>
                            {openTicketCreateCard ? (
                                <Button
                                    accessibilityLabel={ t('close_form') }
                                    tone="critical"
                                    variant="primary"
                                    size="large"
                                    icon={XIcon}
                                    onClick={() => setOpenTicketCreateCard(false)}
                                >{ t('close_form') }</Button>
                            ) : openTicketRepliesCard ? (
                                <Button
                                    accessibilityLabel={ t('close_details') }
                                    tone="critical"
                                    variant="primary"
                                    size="large"
                                    icon={XIcon}
                                    onClick={() => toggleTicketDetails("")}
                                >{ t('close_details') }</Button>
                            ) : (
                                <Button
                                    accessibilityLabel={ t('create_ticket') }
                                    icon={PlusIcon}
                                    variant="primary"
                                    size="large"
                                    onClick={() => setOpenTicketCreateCard(true)}
                                >{ t('create_ticket') }</Button>
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
                                openTicketCreateCard ? (
                                    <TicketCreateCard shopInfo={shopInfo} viewAs="MERCHANT" />
                                ) : openTicketRepliesCard ? (
                                    <TicketDetailsCard ticketDetails={ticketDetails} viewAs="MERCHANT" />
                                ) : (
                                    <IndexTable
                                        resourceName={resourceName}
                                        itemCount={tickets.length}
                                        headings={[
                                            {title: t('ticket_no')},
                                            {title: t('subject')},
                                            {title: t('email')},
                                            {title: t('status')},
                                            {title: t('created_at')},
                                        ]}
                                        selectable={false}
                                    >
                                        {tickets.map((ticket, index) => (
                                            <IndexTable.Row id={index} key={index} position={index}>
                                                <IndexTable.Cell>
                                                    {notification.includes(ticket.id) ?
                                                        <Button onClick={() => toggleTicketDetails(ticket.id)} variant="plain" size="large" icon={AlertBubbleIcon}>
                                                            {ticket.slug}
                                                        </Button>
                                                        :
                                                        <Button onClick={() => toggleTicketDetails(ticket.id)} variant="plain" size="large">
                                                            {ticket.slug}
                                                        </Button>
                                                    }
                                                </IndexTable.Cell>
                                                <IndexTable.Cell>{ticket.subject}</IndexTable.Cell>
                                                <IndexTable.Cell>{ticket.shopEmail}</IndexTable.Cell>
                                                <IndexTable.Cell>{ticket.status == "PENDING" ? "OPEN" : ticket.status}</IndexTable.Cell>
                                                <IndexTable.Cell>{ticket.createdAt}</IndexTable.Cell>
                                            </IndexTable.Row>
                                        ))}
                                    </IndexTable>
                                )
                            )}
                        </Box>
                    </BlockStack>
                </Card>
            </Page>
        </Bleed>
    );
}
