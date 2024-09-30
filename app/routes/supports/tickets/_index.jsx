import { InlineStack, Card, Tabs, Select, BlockStack, Bleed, Page, Grid, DataTable, Divider, Text, TextField, Button, Badge, IndexTable, Box, Spinner, InlineGrid, SkeletonBodyText, SkeletonDisplayText, SkeletonTabs, ButtonGroup, Banner } from '@shopify/polaris';
import { PlusIcon, XIcon, AlertBubbleIcon } from "@shopify/polaris-icons";
import { useState, useCallback, useEffect, useContext, useMemo } from 'react';
import { useTranslation } from "react-i18next";
import { useSubmit, useLoaderData, useActionData } from '@remix-run/react';
import prisma from "../../../db.server";
import { authenticator } from "../../../services/auth.server";
import TicketDetailsCardSupport from '../../../components/TicketDetailsCardSupport';
import TicketCreateCard from '../../../components/TicketCreateCard';
import { getUserAccess } from '../../../libs/helpers';
import { notificationContext } from '../../../contexts/notificationContext';
import { newCreatedTicketContext } from '../../../contexts/newCreatedTicketContext';
export const loader = async ({ request }) => {
    const currentAgent = await getUserAccess(request, authenticator, prisma);

    const tickets = await prisma.tickets.findMany({
        where: {
            supportAgentId: (currentAgent.role == "ADMIN" ||  currentAgent?.permissions?.includes("TCKT_LST_ALL") ) ? undefined : currentAgent.id
        },
        orderBy: {
            id: "desc"
        }
    });

    const agents = await prisma.supportAgents.findMany({
        select: {
            id: true,
            name: true,
        },
        where: {
            NOT: {
                id: currentAgent.id
            }
        }
    })

    const shops = await prisma.shops.findMany({
        select: {
            id: true,
            name: true,
            email: true,
        },
        where: {
            deletedAt: null,
        }
    });

    return {
        target: "ticketsList",
        message: "Success",
        data: {
            tickets: tickets || [],
            shops: shops || [],
            agents: agents || [],
            currentAgent: currentAgent,
        }
    };
};

export const action = async ({ request }) => {
    const formdata = await request.formData();
    const target = formdata.get("target");
    const ticketId = formdata.get("ticketId");

    const currentAgent = await getUserAccess(request, authenticator, prisma);

    try {
        if (target == "create-ticket") {
            const shopId = formdata.get("shopId");
            const email = formdata.get("email");
            const subject = formdata.get("subject");
            const message = formdata.get("message");

            const ticket = await prisma.tickets.create({
                data: {
                    slug: "DRT" + shopId + Date.now(),
                    shopId: parseInt(shopId),
                    shopEmail: email,
                    supportAgentId: currentAgent.id,
                    subject: subject,
                }
            });
            if(ticket) {
                await prisma.ticketReplies.create({
                    data: {
                        ticketId: ticket.id,
                        supportAgentId: currentAgent.id,
                        replyFrom: "SUPPORT",
                        message: message,
                    }
                });

                return {
                    target: target,
                    message: "Success",
                    data: ticket,
                }
            }
            else {
                return {
                    target: "error",
                    message: "Could not create ticket",
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
                            status: true,
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
        else if (target == "agent-update") {
            const oldAgent = formdata.get("oldAgent");
            const newAgent = formdata.get("newAgent");
            const updatedTicket = await prisma.tickets.update({
                where: { id: parseInt(ticketId) },
                data: {
                    supportAgentId: parseInt(newAgent)
                }
            });
            await prisma.ticketsAssignLogs.create({
                data:{
                    ticketId: parseInt(ticketId),
                    oldSupportAgentId: parseInt(oldAgent),
                    newSupportAgentId: parseInt(newAgent),
                    createdById: currentAgent.id
                }
            })

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
            const status = (currentAgent.role == "ADMIN" || currentAgent.permissions.includes("TCKT_RPL_DSUB")) ? "PUBLISHED" : "UNPUBLISHED";
            const newReply = await prisma.ticketReplies.create({
                data: {
                    ticketId: parseInt(ticketId),
                    supportAgentId: currentAgent.id,
                    replyFrom: "SUPPORT",
                    message: message,
                    status: status
                }
            });
            if(newReply && newReply.id) {
                // Now check if this ticket is PENDING or not
                // If it is PENDING that measns no support agent has replied to it
                // Now then make it OPEN
                const ticket = await prisma.tickets.findFirst({
                    where: { id: parseInt(ticketId), status: "PENDING" }
                });
                if(ticket && ticket.id) {
                    await prisma.tickets.update({
                        where: { id: parseInt(ticketId) },
                        data: {
                            status: "OPEN"
                        }
                    });
                }
            }

            return {
                target: target,
                message: "Success",
                data: {
                    newReply: newReply
                },
            }
        }
        else if (target == "reply-status-update") {
            const replyId = formdata.get("replyId");
            const status = formdata.get("status");
            await prisma.ticketReplies.update({
                where: { id: parseInt(replyId) },
                data: {
                    status: status
                }
            });
            const updatedReply =  await prisma.ticketReplies.findFirst({
                where: { id: parseInt(replyId) },
                select: {
                    id: true,
                    supportAgentId: true,
                    replyFrom: true,
                    message: true,
                    status: true,
                    createdAt: true,
                    supportAgent: {
                        select: { id: true, name: true, role: true }
                    }
                }
            });

            return {
                target: target,
                message: "Success",
                data: {
                    updatedReply: updatedReply
                },
            }
        }
        else if (target == "reply-message-update") {
            const replyId = formdata.get("replyId");
            const message = formdata.get("message");
            const status = formdata.get("status");
            await prisma.ticketReplies.update({
                where: { id: parseInt(replyId) },
                data: {
                    message: message,
                    status: status
                }
            });
            const updatedReply =  await prisma.ticketReplies.findFirst({
                where: { id: parseInt(replyId) },
                select: {
                    id: true,
                    supportAgentId: true,
                    replyFrom: true,
                    message: true,
                    status: true,
                    createdAt: true,
                    supportAgent: {
                        select: { id: true, name: true, role: true }
                    }
                }
            });

            return {
                target: target,
                message: "Success",
                data: {
                    updatedReply: updatedReply
                },
            }
        }
        else if (target == "reply-delete") {
            const replyId = formdata.get("replyId");
            const ticketId = formdata.get("ticketId");
            await prisma.ticketReplies.delete({
                where: { id: parseInt(replyId) },
            });

            const ticketDetails = await prisma.tickets.findFirst({
                include: {
                    ticketReplies: {
                        select: {
                            id: true,
                            supportAgentId: true,
                            replyFrom: true,
                            message: true,
                            status: true,
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
            return {
                target: target,
                message: "Success",
                data: {
                    ticketDetails: ticketDetails
                },
            }
        }
    } catch (err) {
		return {
			target: "error",
			message: "Something went wrong!",
			data: err,
		};
	}
}

export default function TicketList() {
    const loaderData = useLoaderData();
    const actionData = useActionData();
    const submit = useSubmit();
    const { t } = useTranslation();

    const [pageError, setPageError] = useState("");
    const [pageLoader, setPageLoader] = useState(true);
    const [openTicketCreateCard, setOpenTicketCreateCard] = useState(false);
    const [openTicketRepliesCard, setOpenTicketRepliesCard] = useState(false);
    const [selectedTab, setSelectedTab] = useState(0);

    const currentAgent = { ...loaderData.data.currentAgent }
    const agents = [ ...loaderData.data.agents ];
    const shops = [ ...loaderData.data.shops ];
    const [ initialTickets, setInitialTickets] = useState([ ...loaderData.data.tickets ]);
    const [tickets, setTickets] = useState([]);
    const [ticketDetails, setTicketDetails] = useState(null);
    const { notification, setNotification } = useContext(notificationContext);
    const resourceName = {
        singular: 'ticket',
        plural: 'tickets',
    };

    useEffect(() => {
		if(loaderData && loaderData.target == "ticketsList" && loaderData.message == "Success") {
			if(initialTickets.length > 0) {
                // As the Open tab is opened by default, we have to set opened ticket list for this tab
                setTickets(categorizedTickets(0));
            }

            if(pageLoader) {
                setPageLoader(false);
            }
		}
	}, []);

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
            return initialTickets.filter(ticket => ticket.status == "PENDING");
        }
        else if(index == 1) {
            return initialTickets.filter(ticket => ticket.status == "OPEN");
        }
        else if(index == 2) {
            return initialTickets.filter(ticket => ticket.status == "SOLVED");
        }
        else if(index == 3) {
            return initialTickets.filter(ticket => ticket.status == "CANCELED");
        }
    }

    const toggleTicketDetails = (ticketId) => {
        // Now, if ticketId exists, then call action
        if(ticketId) {
            setOpenTicketRepliesCard(true);
            submit({ target: "ticket-replies", ticketId: ticketId }, { method: "POST" });
        }
        else {
            setOpenTicketRepliesCard(false);
            setTicketDetails(null);
        }

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

    const {newTicket, setNewTicket} = useContext(newCreatedTicketContext);
    
    useEffect(() => {
        if (newTicket) {
            // Check if the newTicket is already in initialTickets by matching some unique property like 'id'
            const isTicketAlreadyAdded = initialTickets.some(ticket => ticket.id === newTicket.id);
    
            if (!isTicketAlreadyAdded) {
                // Add the new ticket only if it isn't already present
                setInitialTickets((prevTickets) => [...prevTickets, newTicket]);
            }
        }
	}, [newTicket]);
   
    useEffect(() => {
        // Update the ticket list when initialTickets changes, based on the current tab
        setTickets(categorizedTickets(selectedTab));
    }, [initialTickets, selectedTab]);
    
    useEffect(() => {
        if(actionData) {
            setPageError("");
            if(actionData.target == "error") {
                setPageError(actionData.message);
            }
            else if (actionData.target == "ticket-replies" && actionData.message == "Success" && actionData.data?.ticketDetails?.id) {
                if(ticketDetails == null) {
                    setTicketDetails(actionData.data.ticketDetails);
                }
            }
            else if (actionData.target == "reply-status-update" && actionData.message == "Success" && actionData.data.updatedReply.id) {
                // Update the ticketReplies array
                ticketDetails.ticketReplies = ticketDetails.ticketReplies.map(reply =>
                    reply.id === actionData.data.updatedReply.id ? actionData.data.updatedReply : reply
                );
                setTicketDetails(ticketDetails)
            }
            else if (actionData.target == "reply-delete" && actionData.message == "Success" && actionData.data?.ticketDetails?.id) {
                setTicketDetails(actionData.data.ticketDetails);
            }
            else if (actionData.target == "status-update" && actionData.message == "Success" && actionData.data?.updatedTicket?.id) {
                const updatedInitialTicket = initialTickets.find(ticket => ticket.id === actionData.data?.updatedTicket?.id);
                updatedInitialTicket.status = actionData.data?.updatedTicket?.status;

                if(actionData.data?.updatedTicket?.status == "PENDING") {
                    handleTabChange(0);
                }
                if(actionData.data?.updatedTicket?.status == "OPEN") {
                    handleTabChange(1);
                }
                else if(actionData.data?.updatedTicket?.status == "SOLVED") {
                    handleTabChange(2);
                }
                else if(actionData.data?.updatedTicket?.status == "CANCELED") {
                    handleTabChange(3);
                }
            }
            else if (actionData.target == "agent-update" && actionData.message == "Success" && actionData.data?.updatedTicket?.id) {
                window.location.reload();
            }
            else if (actionData.target == "create-ticket" && actionData.message == "Success" && actionData.data?.id) {
                initialTickets.unshift(actionData.data);
                handleTabChange(0);
            }
        }
	}, [actionData]);

     //notification state gets popluated if context has value
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
                            {showNotificationIcon && selectedTab == 0?
                                <Button variant="tertiary" pressed={selectedTab == 0} onClick={() => handleTabChange(0)} icon={AlertBubbleIcon}>Pending</Button>
                                :
                                <Button variant="tertiary" pressed={selectedTab == 0} onClick={() => handleTabChange(0)}>Pending</Button>
                                }
                                {showNotificationIcon && selectedTab == 1?
                                <Button variant="tertiary" pressed={selectedTab == 1} onClick={() => handleTabChange(1)} icon={AlertBubbleIcon}>{ t('opened') }</Button>
                                :
                                <Button variant="tertiary" pressed={selectedTab == 1} onClick={() => handleTabChange(1)}>{ t('opened') }</Button>
                                }
                                <Button variant="tertiary" pressed={selectedTab == 2} onClick={() => handleTabChange(2)}>Solved</Button>
                                <Button variant="tertiary" pressed={selectedTab == 3} onClick={() => handleTabChange(3)}>Canceled</Button>
                            </ButtonGroup>
                            {openTicketCreateCard ? (
                                <Button
                                    accessibilityLabel="Close"
                                    tone="critical"
                                    variant="primary"
                                    size="large"
                                    icon={XIcon}
                                    onClick={() => setOpenTicketCreateCard(false)}
                                >Close form</Button>
                            ) : openTicketRepliesCard ? (
                                <Button
                                    onClick={() => toggleTicketDetails("")}
                                    accessibilityLabel="Close"
                                    tone="critical"
                                    variant="primary"
                                    size="large"
                                    icon={XIcon}
                                >Close details</Button>
                            ) : currentAgent?.permissions?.includes("TCKT_CRT") && (
                                <Button
                                    accessibilityLabel="Create ticket"
                                    icon={PlusIcon}
                                    variant="primary"
                                    size="large"
                                    onClick={() => setOpenTicketCreateCard(true)}
                                >
                                    Create ticket
                                </Button>
                            )}
                        </InlineStack>
                        <Divider />
                        <Box>
                            {pageError && pageError != "" && (
                                <Banner title="Warning" tone="warning">
                                    <p>{pageError}</p>
                                </Banner>
                            )}
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
                                    <TicketCreateCard shops={shops} viewAs="SUPPORT" />
                                ) : openTicketRepliesCard ? (
                                    <TicketDetailsCardSupport ticketDetails={ticketDetails} currentAgent={currentAgent} agentList={agents} />
                                ) : (
                                    <IndexTable
                                        resourceName={resourceName}
                                        itemCount={tickets.length}
                                        headings={[
                                            {title: 'Ticket no'},
                                            {title: 'Subject'},
                                            {title: 'Email'},
                                            {title: 'Status'},
                                            {title: 'Created at'},
                                        ]}
                                        selectable={false}
                                    >
                                        {(currentAgent.role == "ADMIN" || currentAgent?.permissions?.includes("TCKT_LST_ALL") || currentAgent?.permissions?.includes("TCKT_LST")) && tickets.map((ticket, index) => (
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
                                                <IndexTable.Cell>{ticket.status}</IndexTable.Cell>
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

