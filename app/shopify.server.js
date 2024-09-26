import "@shopify/shopify-app-remix/adapters/node";
import { ApiVersion, AppDistribution, DeliveryMethod, shopifyApp, } from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-04";
import prisma from "./db.server";
import { createActivityLog, defaultCssStyle } from './libs/helpers';

const shopify = shopifyApp({
	apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
	apiSecretKey: import.meta.env.VITE_SHOPIFY_API_SECRET || "",
	apiVersion: ApiVersion.April24,
	scopes: import.meta.env.VITE_SCOPES?.split(","),
	appUrl: import.meta.env.VITE_SHOPIFY_APP_URL || "",
	authPathPrefix: "/auth",
	sessionStorage: new PrismaSessionStorage(prisma),
	distribution: AppDistribution.AppStore,
	restResources,
	webhooks: {
		APP_UNINSTALLED: {
			deliveryMethod: DeliveryMethod.Http,
			callbackUrl: "/webhooks",
		},
		DISCOUNTS_DELETE: {
			deliveryMethod: DeliveryMethod.Http,
			callbackUrl: "/webhooks",
		},
		DISCOUNTS_UPDATE: {
			deliveryMethod: DeliveryMethod.Http,
			callbackUrl: "/webhooks",
		},
	},
	hooks: {
		afterAuth: async ({ session, admin }) => {
			try {
				// Get shop information upon installation
				const shopResponse = await admin.graphql(
					`#graphql
                    query shop{
                        shop {
                            id
                            name
                            email
                            url
                            myshopifyDomain
                            billingAddress {
                                id
                                company
                                phone
                                city
                                country
                                countryCodeV2
                                province
                                provinceCode
                                zip
                                coordinatesValidated
                                latitude
                                longitude
                            }
                            unitSystem
                            weightUnit
                        }
                    }`
				);
				const shopResponseJson = await shopResponse.json();
				const shop = shopResponseJson?.data?.shop;

				// Check if we realy have a shop info
				if (shop && shop.id) {
					createActivityLog({type: "info", shop: shop.myshopifyDomain, subject: "Current shop info on app installation", body: shop });
					// Now, we can have a problem here,
					// what if this shop installed our app then uninstalled and now installing it again?
					// On first install its info were stored, but now what to do?
					// So, if the shop information already exists, then we'll just update it
					// Else, we'll create a new shop

					// Store shop data to app DB
					let existingShop = await prisma.shops.findFirst({
						where: {
							gid: shop.id
						}
					});

					if (existingShop && existingShop.id) {
						createActivityLog({type: "info", shop: shop.myshopifyDomain, subject: "Existing shop info on app installation", body: existingShop });
						const existingShopUpdatedInfo = await prisma.shops.update({
							where: {
								gid: shop.id,
							},
							data: {
								name: shop.name,
								email: shop.email,
								url: shop.url,
								billingAddress: JSON.stringify(shop.billingAddress),
								unitSystem: shop.unitSystem,
								weightUnit: shop.weightUnit,
								installCount: (existingShop.installCount + 1),
								updatedAt: new Date().toISOString(),
							}
						});
						createActivityLog({type: "success", shop: shop.myshopifyDomain, subject: "Existing shop updated info on app installation", body: existingShopUpdatedInfo });

						// Get all discounts from mysql db
						const discounts = await prisma.discounts.findMany({
							where: {
								shopId: existingShop.id,
								deletedAt: null
							}
						});

						// Loop through the discounts and conduct mutation on each iteration
						for (let i = 0; i < discounts.length; i++) {
							const discount = discounts[i]; // get the current discount
							const jsonDataDiscountValues = JSON.parse(discount.discountValues);
							const jsonStringDiscountValues = JSON.stringify(jsonDataDiscountValues);

                            // We set the start and end date to a past date so that this discount be created as "Expired"
                            const dateInPast = new Date();
                            dateInPast.setDate(dateInPast.getDate() - 1);

							// Graphql query and variable starts here
							const graphqlQuery = `#graphql
                            mutation discountAutomaticAppCreate($automaticAppDiscount: DiscountAutomaticAppInput!) {
                                discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
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
							// Based on discount type, metafields being set here
							let metafields = [];
							if (discount.type == 'QUANTITY_DISCOUNT') {
								metafields = [
									{
										namespace: "$app:quantity-discount",
										key: "dr-quantity-discount-function-configuration",
										type: "json",
										value: jsonStringDiscountValues,
									}
								]
							}
							else if (discount.type == 'PRICE_DISCOUNT') {
								metafields = [
									{
										namespace: "$app:dr-price-discount",
										key: "dr-price-discount-function-configuration",
										type: "json",
										value: jsonStringDiscountValues,
									}
								]
							}
							const queryParams = {
								variables: {
									automaticAppDiscount: {
										title: discount.title,
										functionId: discount.functionId,
										startsAt: dateInPast,
										endsAt: dateInPast,
										combinesWith: {
											productDiscounts: true
										},
										metafields: metafields
									},
								}
							};

							const response = await admin.graphql(graphqlQuery, queryParams);
							const responseJson = await response.json();
							if (responseJson?.data?.discountAutomaticAppCreate?.automaticAppDiscount?.discountId) {
								await prisma.discounts.update({
									where: {
										id: discount.id,
									},
									data: {
										discountId: responseJson.data.discountAutomaticAppCreate.automaticAppDiscount.discountId,
                                        startsAt: dateInPast,
                                        endsAt: dateInPast,
									}
								});
								createActivityLog({type: "success", shop: shop.myshopifyDomain, subject: "Old discount recreate", body: responseJson, query: graphqlQuery, variables: queryParams });
							}
							else {
								createActivityLog({type: "error", shop: shop.myshopifyDomain, subject: "Old discount recreate", body: responseJson, query: graphqlQuery, variables: queryParams });
							}
						}
						// This method store app activity log
						createActivityLog({type: "info", shop: shop.myshopifyDomain, subject: "App installation process related operations executed", body: shop });
					}
					else {
						const newShop = await prisma.shops.create({
							data: {
								gid: shop.id,
								name: shop.name,
								email: shop.email,
								url: shop.url,
								myshopifyDomain: shop.myshopifyDomain,
								billingAddress: JSON.stringify(shop.billingAddress),
								unitSystem: shop.unitSystem,
								weightUnit: shop.weightUnit,
								installCount: 1,
								createdAt: new Date().toISOString()
							}
						});
						createActivityLog({type: "info", shop: shop.myshopifyDomain, subject: "New shop info created", body: newShop });

						// Create setting for this shop
						const newShopSettings = await prisma.settings.create({
							data: {
								shopId: newShop.id,
								productPage: JSON.stringify({
									layout: "table_view",
                                    quantity_column_header: "Buy",
                                    quantity_column_text: "[QTY] or more",
                                    discount_column_header: "Get",
                                    discount_column_text: "[DISCOUNT] off!",
                                    list_text: "Buy [QTY] or more and save [DISCOUNT]",
                                    show_discount_value: "show_as_set",
                                    css_style: defaultCssStyle,
								}),
                                shopVariables: JSON.stringify({
                                    how_to_video: 1,
                                }),
							}
						});
						createActivityLog({type: "info", shop: shop.myshopifyDomain, subject: "New shop settings created", body: newShopSettings });

						/**
						 * TODO: Webhook subscription at first time install
						 * TODO: First, subscribe to DISCOUNTS_DELETE webhook
						 * TODO: Second, subscribe to DISCOUNTS_UPDATE webhook
						 */
						const webhookQuery = `#graphql
                        mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
                            webhookSubscriptionCreate(
                                topic: $topic
                                webhookSubscription: $webhookSubscription
                            ){
                                userErrors {
                                    field
                                    message
                                }
                                webhookSubscription {
                                    id
                                    metafieldNamespaces
                                    includeFields
                                }
                            }
                        }`;
						const webhookQueryParamsDelete = {
							variables: {
								"topic": "DISCOUNTS_DELETE",
								"webhookSubscription": {
									"callbackUrl": import.meta.env.VITE_APP_WEBHOOK_URL,
									"format": "JSON"
								}
							}
						};
						const webhookResponseDelete = await admin.graphql(webhookQuery, webhookQueryParamsDelete);
						const webhookResponseDeleteJson = await webhookResponseDelete.json();
						if (webhookResponseDeleteJson?.data?.webhookSubscriptionCreate?.webhookSubscription?.id) {
							createActivityLog({type: "success", shop: shop.myshopifyDomain, subject: "Subscribe to DISCOUNTS_DELETE webhook", body: webhookResponseDeleteJson });
						}
						else {
							createActivityLog({type: "error", shop: shop.myshopifyDomain, subject: "Subscribe to DISCOUNTS_DELETE webhook", body: webhookResponseDeleteJson, query: webhookQuery, variables: webhookQueryParamsDelete });
						}

						const webhookQueryParamsUpdate = {
							variables: {
								"topic": "DISCOUNTS_UPDATE",
								"webhookSubscription": {
									"callbackUrl": import.meta.env.VITE_APP_WEBHOOK_URL,
									"format": "JSON"
								}
							}
						};
						const webhookResponseUpdate = await admin.graphql(webhookQuery, webhookQueryParamsUpdate);
						const webhookResponseUpdateJson = await webhookResponseUpdate.json();
						// This method store app activity log of discounts update
						if (webhookResponseUpdateJson?.data?.webhookSubscriptionCreate?.webhookSubscription?.id) {
							createActivityLog({type: "success", shop: shop.myshopifyDomain, subject: "Subscribe to DISCOUNTS_UPDATE webhook", body: webhookResponseUpdateJson });
						}
						else {
							createActivityLog({type: "error", shop: shop.myshopifyDomain, subject: "Subscribe to DISCOUNTS_UPDATE webhook", body: webhookResponseUpdateJson, query: webhookQuery, variables: webhookQueryParamsUpdate });
						}
						// This method store app activity log
						createActivityLog({type: "info", shop: shop.myshopifyDomain, subject: "App installation process related operations executed", body: shop });
					}
					shopify.registerWebhooks({ session });
				}
				else {
					createActivityLog({type: "error", subject: "Shop not found on app installation" });
				}
			} catch (error) {
				createActivityLog({type: "error", subject: "Catch - on app installation", body: error});
			}
		},
	},
	future: {
		v3_webhookAdminContext: true,
		v3_authenticatePublic: true,
		v3_lineItemBilling: true,
		unstable_newEmbeddedAuthStrategy: true,
	},
	...(import.meta.env.VITE_SHOP_CUSTOM_DOMAIN
		? { customShopDomains: [import.meta.env.VITE_SHOP_CUSTOM_DOMAIN] }
		: {}),
});

export default shopify;
export const apiVersion = ApiVersion.April24;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
