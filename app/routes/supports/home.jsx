import { Page } from "@shopify/polaris";
import { Outlet, useLoaderData, useSubmit } from "@remix-run/react";
import { useEffect, useState } from "react";
import { json } from "@remix-run/node";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { ExitIcon } from '@shopify/polaris-icons';
import prisma from "../../db.server";
import { authenticator } from "../../services/auth.server";
import { getUserAccess } from "../../libs/helpers";
import { NotificationProvider, notificationContext } from "../../contexts/notificationContext";
import { NewCreatedTicketProvider } from "../../contexts/newCreatedTicketContext";
import  {io} from "socket.io-client";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export async function loader({ request }) {
    // Check if user is logged in or not
    await authenticator.isAuthenticated(request, {
        failureRedirect: "/supports/signin",
    });

    // Get current agent role and permissions
    const currentAgent = await getUserAccess(request, authenticator, prisma);

    return json({
        userRole: currentAgent.role,
        userPermissions: currentAgent.permissions
    });
}

export const action = async ({ request }) => {
    const formdata = await request.formData();
    const target = formdata.get('target');
    if (target == "logout") {
        await authenticator.logout(request, { redirectTo: "/supports/signin" });
    }
}

export default function Support() {
    const loaderData = useLoaderData() || {};
    const userRole = loaderData?.userRole || "";
    const userPermissions = loaderData?.userPermissions || [];
    const submit = useSubmit();

    const apiKey = loaderData?.apiKey;

    const [secondaryActions, setSecondaryActions] = useState([]);

    useEffect(() => {
        const existingActions = [{content: "Dashboard", url: "/supports"}];
        if(userPermissions.includes("TCKT_LST") || userRole == "ADMIN") {
            existingActions.push({content: "Ticket", url: "/supports/tickets"});
        }
        if(userPermissions.includes("BNNR_LST") || userRole == "ADMIN") {
            existingActions.push({content: "Banner", url: "/supports/banners"});
        }
        if(userPermissions.includes("ART_LST") || userRole == "ADMIN") {
            existingActions.push({content: "Article", url: "/supports/articles"});
        }
        if(userPermissions.includes("YTVD_LST") || userRole == "ADMIN") {
            existingActions.push({content: "Video", url: "/supports/videos"});
        }
        if(userPermissions.includes("RAPP_LST") || userRole == "ADMIN") {
            existingActions.push({content: "RecomApp", url: "/supports/recommended-apps"});
        }
        if(userPermissions.includes("FAQ_LST") || userRole == "ADMIN") {
            existingActions.push({content: "FAQ", url: "/supports/faqs"});
        }
        if(userPermissions.includes("FRQ_LST") || userRole == "ADMIN") {
            existingActions.push({content: "FeatReq", url: "/supports/feature-requests"});
        }
        if(userPermissions.includes("AGT_LST") || userRole == "ADMIN") {
            existingActions.push({content: "Agent", url: "/supports/agents"});
        }
        if(userPermissions.includes("PRMSN_LST") || userRole == "ADMIN") {
            existingActions.push({content: "Permission", url: "/supports/permissions"});
        }
        existingActions.push({content: "Logout", destructive: true, icon: ExitIcon, onAction: () => logout()});
        setSecondaryActions(existingActions);
    }, [loaderData]);

    const logout = () => {
        submit({ target: "logout", data: JSON.stringify({}) }, { method: "POST" });
    }

    const [notification, setNotification] = useState([]);
    const [newTicket, setNewTicket] = useState(null);
     //socket.io related section start
    const [socket, setSocket] = useState();
 
    useEffect(() => {
     const socket = io("wss://socket.efoli.com/socket.io", {
     reconnectionDelayMax: 10000
    });
        setSocket(socket);
        return () => {
            socket.disconnect();
        };
    }, []);

    useEffect(() => {
        if (!socket) return;
        
        socket.on("newTicketInMerchantToSupport", (data) => {
            toast.info(`New ticket! - ticket no.:${data.ticket.slug} subject: ${data.ticket.subject} `, {
                position: "top-right",
                autoClose: false
            });
            setNewTicket(()=>{return data.ticket})
        });

        socket.on("serverResForSupport", (data) => {
            setNotification((notification) => {
                const message = `Ticket reply - slug: ${data.slug}, subject: ${data.subject}`
                toast.info(message, {
                    position: "top-right"
                });
                if (!notification.includes(data.id)) {
                    return [...notification, data.id];
                }
                return notification;
            });
              
        });
    }, [socket]);
     //socket.io related section ends
    return (
        <NotificationProvider value={{ notification, setNotification }}>
            <NewCreatedTicketProvider value={{newTicket, setNewTicket}}>
                <AppProvider isEmbeddedApp={false} apiKey={apiKey}>
                    <Page title="DiscountRay Support" secondaryActions={secondaryActions}>
                        <Outlet />
                        <ToastContainer></ToastContainer>
                    </Page>
                </AppProvider>
            </NewCreatedTicketProvider>
        </NotificationProvider>
    );
}
