import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { json } from "@remix-run/node";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { calculateRemainingTrialDays } from "../libs/helpers";
import { useTranslation } from "react-i18next";
import { NotificationProvider} from "../contexts/notificationContext";
import { NewTicketIdContextProvider } from "../contexts/newTicketIdContext";
import { useState, useEffect } from "react";
import  {io} from "socket.io-client";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
    const { admin, redirect } = await authenticate.admin(request);

    const graphqlQuery = `#graphql
    query shop{
        shop {
            id
        }
    }`;
    const response = await admin.graphql(graphqlQuery, "");
    const shopResponseJson = await response.json();

    // Get shop info from prima storage using shop GID  
    const shop = await prisma.shops.findFirst({
        select: {
            id: true,
            myshopifyDomain: true,
            planId: true,
            planType: true,
            trialStartsAt: true,
            trialPeriod: true,
            createdAt: true,
            plan: true,
        },
        where: { gid: shopResponseJson.data.shop.id },
    });

    const remainingTrialPeriod = calculateRemainingTrialDays(shop.trialStartsAt, shop.trialPeriod);
    /**
     * TODO: If "remainingTrialPeriod" has negative or zero value, that means trial period has been used up and no trial is left
     * TODO: Set the shop's "trialPeriod" to "0"
     */
    if(remainingTrialPeriod != null && remainingTrialPeriod <= 0) {
        await prisma.shops.update({
            where: { id: parseInt(shop.id) },
            data: {
                trialStartsAt: null,
                trialPeriod: 0,
            }
        });
    }

    /**
     * * Take a flag that determines if this shop has full access to our app
     * ? The shop has subscribed to a plan
     * ? The subscribed plan has validity
     */
    let fullAccess = false;
    // Get the current route
    const redirectTo = new URL(request.url).pathname;
    // Check if shop has subscribed to any plan
    if(shop && shop.planId) {
        /**
         * * The shop has subscribed to a plan
         * TODO: Now check if current route is inaccessible for shops with subscription plan
         * TODO: If yes, stop them from proceeding to current route, and redirect to app main route
         * TODO: Otherwise, let them proceed to current route
         * TODO: And set the "fullAccess" flag to true
         */
        if(redirectTo == "/app/welcome") {
            throw redirect("/app");
        }
        fullAccess = true;
    }
    else {
        /**
         * * The shop does not have any subscription plan
         * TODO: Now check if current route is inaccessible for shops without subscription
         * TODO: If yes, stop them from proceeding to current route, and redirect to welcome page
         * TODO: Otherwise, let them proceed to current route
         */
        if(redirectTo != "/app/welcome" && redirectTo != "/app/plans" && redirectTo != "/app/purchase-success") {
            throw redirect("/app/welcome");
        }
    }

    const shopInfo = await prisma.shops.findFirst({
		select: {
            id: true,
            name: true,
            email: true,
        },
		where: {
			myshopifyDomain: shopResponseJson.data.shop.myshopifyDomain,
		},
	});

    const ticketIds = await prisma.tickets.findMany({
        where: {
            shopId: shopInfo.id
        },
        orderBy: {
            id: "desc"
        },
        select: {
            id:true
        }
    })
    return json({
        shop: shop,
        fullAccess: fullAccess,
        apiKey: import.meta.env.VITE_SHOPIFY_API_KEY || "",
        ticketIds
    });
};

export default function App() {
    const { t } = useTranslation();
    const loaderData = useLoaderData() || {};

    const apiKey = loaderData?.apiKey;
    const fullAccess = loaderData?.fullAccess;

    const ticketIds = loaderData?.ticketIds;
    const [id, setId] = useState(null)
    const [notification, setNotification] = useState([]);

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

    //update ticketIds array when new ticket created
    useEffect(() => {
        //when new ticket created, ticket id saved in ticketIds with the values from loader ticketIds
        ticketIds.push({id: id});

        if (!socket) return;

        socket.on("serverResForMerchant", (data) => {
            //one by one ticket id added to notification arr
            if (ticketIds.map(ticket=>ticket.id).includes(data.id)) {
                
                    setNotification((notification) => {
                        const message = `Ticket reply - slug: ${data.slug}, subject: ${data.subject}`
                        //show toast message
                        toast.info(message, {
                            position: "top-right"
                          });
                        //populate the notification context and store the ticketIds to localStorage
                        if (!notification.includes(data.id)) {
                            window.localStorage.setItem("ticketIds", JSON.stringify([...notification, data.id]));
                            return [...notification, data.id];
                        }
                        
                        return notification;
                    });
                
            }
        });
    }, [socket, id]);

    
    return (
        <NotificationProvider value={{ notification, setNotification }}>
            <NewTicketIdContextProvider value={{ id, setId }}>
                <AppProvider isEmbeddedApp apiKey={apiKey}>
                    <ui-nav-menu>
                        <Link to="/app" rel="home">{ t("home") }</Link>
                        {fullAccess && (
                            <>
                                <Link to="/app/new-offer">{ t("create_new") }</Link>
                                <Link to="/app/offer-list">{ t("offer_list") }</Link>
                                <Link to="/app/settings">{ t("app_settings") }</Link>
                            </>
                        )}
                        <Link to="/app/plans">{ t("package_plans") }</Link>
                        <Link to="/app/get-support">{ t("get_support") }</Link>
                    </ui-nav-menu>
                    <Outlet />
                    <ToastContainer />
                </AppProvider>
            </NewTicketIdContextProvider>
        </NotificationProvider>        
    );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
    return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
    return boundary.headers(headersArgs);
};
