import { Bleed, Banner,  BlockStack, Box, Button, Card, Divider, Page, Text, TextField } from '@shopify/polaris';
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import React, { useEffect, useState } from "react";
import { authenticator } from "../../services/auth.server";
import { redirect, useActionData, useSubmit } from "@remix-run/react";
import { commitSession, getSession } from "../../services/session.server";
import { createActivityLog } from '../../libs/helpers';

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export async function loader({ request }) {
    // If the user is already authenticated redirect to /dashboard directly
    return await authenticator.isAuthenticated(request, {
        successRedirect: "/supports",
    });
}

// Second, we need to export an action function, here we will use the
// `authenticator.authenticate method`
export async function action({ request }) {
    try {
        let user = await authenticator.authenticate("user-pass", request, {
            failureRedirect: "/supports/signin",
        });
    
        if (!user?.id) {
            return {
                target: "error",
                message: "Sorry! email or password did not match!",
                data: {},
            };
        }
    
        // manually get the session
        let session = await getSession(request.headers.get("cookie"));
        // and store the user data
        session.set(authenticator.sessionKey, user?.email);
        session.set("sessionId", user?.id);
        session.set("sessionGuard", user?.role);
    
        // commit the session
        let headers = new Headers({ "Set-Cookie": await commitSession(session) });
        return redirect("/supports", { headers });
    } catch (error) {
        createActivityLog({type: "error", shop: "support", subject: "Support signin", body: error});
        return {
            target: "error",
            message: "Sorry! something went wrong!",
            data: error
        };
    }
}

export default function SignIn() {
    const submit = useSubmit();
    const actionData = useActionData() || {};

    const [formLoader, setFormLoader] = useState(false);
    const [formState, setFormState] = useState({
        email: "",
        password: "",
    });
    const [formError, setFormError] = useState({
        email: "",
        password: "",
    });
    const handleEmailChange = (newValue) => {
        setFormState({ ...formState, email: newValue });
    };
    const handlePasswordChange = (newValue) => {
        setFormState({ ...formState, password: newValue });
    };

    // After submit data "submitForm" function send all formData to the action
    const submitForm = async () => {
        setFormLoader(true);
        // Form validation
        if(!formState.email || formState.email == "") {
            setFormError({ ...formError, email: "Email is required" });
            setFormLoader(false);
        }
        else if(!formState.password || formState.password == "") {
            setFormError({ ...formError, password: "Password is required" });
            setFormLoader(false);
        }
        else {
            submit(formState, { method: "POST" });
        }
    };

    useEffect(() => {
        if(actionData.target == "error") {
            if(formLoader) {
                setFormLoader(false);
            }
        }
    }, [actionData]);

    return (
        <AppProvider isEmbeddedApp={false}>
            <Bleed>
                <Page title="Sign In">
                    <BlockStack gap={300}>
                        {!formLoader && actionData?.target == "error" && (
                            <Banner title={actionData?.message} tone="warning" />
                        )}
                        <Card padding={600}>
                            <BlockStack gap={400}>
                                <BlockStack gap={200}>
                                    <Text as="h1" variant="headingSm">Email</Text>
                                    <TextField
                                        type="email"
                                        placeholder="Email"
                                        name="title"
                                        onChange={handleEmailChange}
                                        value={formState.email}
                                    />
                                    {formError.email && (
                                        <Text as="p" tone="critical">
                                            {formError.email}
                                        </Text>
                                    )}
                                </BlockStack>
                                <BlockStack gap={200}>
                                    <Text as="h1" variant="headingSm">Password</Text>
                                    <TextField
                                        type="password"
                                        placeholder="Password"
                                        name="Password"
                                        onChange={handlePasswordChange}
                                        value={formState.password}
                                    />
                                    {formError.password && (
                                        <Text as="p" tone="critical">
                                            {formError.password}
                                        </Text>
                                    )}
                                </BlockStack>
                                <Button
                                    variant="primary"
                                    size="large"
                                    onClick={submitForm}
                                    loading={formLoader}
                                >
                                    Sign in
                                </Button>
                            </BlockStack>
                        </Card>
                    </BlockStack>
                </Page>
            </Bleed>
        </AppProvider>
    );
}
