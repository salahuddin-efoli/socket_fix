import { Bleed, BlockStack, Box, Button, Banner, Card, Divider, Page, Select, SkeletonBodyText, Text, TextField, Grid, EmptyState, SkeletonDisplayText, InlineStack, DropZone, Thumbnail } from '@shopify/polaris';
import { ListBulletedIcon, NoteIcon, XCircleIcon } from '@shopify/polaris-icons';
import { useEffect, useState, useCallback } from 'react';
import { redirect, useActionData, useLoaderData, useNavigate, useSubmit } from '@remix-run/react';
import prisma from '../../../db.server';
import { authenticator } from "../../../services/auth.server";
import { createActivityLog, getUserAccess } from '../../../libs/helpers';
import { unstable_composeUploadHandlers, unstable_parseMultipartFormData, unstable_createFileUploadHandler, unstable_createMemoryUploadHandler } from "@remix-run/node";
import path from 'path';
import fs from "fs";

export const loader = async ({ request, params }) => {
    const currentAgent = await getUserAccess(request, authenticator, prisma);

    // If current agent do not have access to edit operation, redirect him to list page
    if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("RAPP_EDT")) {
        return redirect("/supports/recommended-apps");
    }
    // Else proceed to regular operations

    const recommendedApp = await prisma.recommendedApps.findFirst({
        where: {
            id: parseInt(params.id)
        }
    });

    return {
        target: "RecommendedAppInfo",
        message: "Success",
        data: recommendedApp
    }
}

export const action = async ({ request, params }) => {
    // Here is file upload code insted of request.formdata
    let formdata = await unstable_parseMultipartFormData(
        request,
        unstable_composeUploadHandlers(
            unstable_createFileUploadHandler({
                // Limit file upload to images
                filter({ contentType }) {
                    return (contentType.includes("image"));
                },
                directory: "./public/images/recomm_app",
                file({ filename }) {
                    const uniqueSuffix = `${Date.now()}`;
                    const extension = path.extname(filename);
                    return `${uniqueSuffix}${extension}`;
                },
            }),
            unstable_createMemoryUploadHandler(),
        ),
    );

    const target = formdata.get('target') || "";

    // Store recommended app basic  info to the DB
    if (target == "update-recommended-app") {
        const currentAgent = await getUserAccess(request, authenticator, prisma);

        // If current agent do not have access to edit operation, redirect him to list page
        if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("RAPP_EDT")) {
            return {
                target: "critical",
                message: "You do not have permission to perform this operation",
                data: [],
            }
        }
        // Else proceed to regular operations

        const newSerial =  formdata.get('serial') ? parseInt(formdata.get('serial')) : "";
        const file = formdata.get('file') || "";
        const oldImage = formdata.get('oldImage') || "";

        let imageDir = "";
        if (file?.name){
            imageDir = "/images/recomm_app/" + file?.name;
            // Delete the old image if file exists
            if (oldImage && fs.existsSync(path.join("public", oldImage))) {
                fs.unlinkSync(path.join("public", oldImage))
            }
        }else{
            imageDir = oldImage;
        }

        const name = formdata.get('name') || "";
        const url = formdata.get('url') || "";
        const description = formdata.get('description') || "";
        const validity = formdata.get('validity') ? new Date(formdata.get('validity')).toISOString() : "";
        const status = formdata.get('status') || "";

        /**
         * * Update an existing RecommendedApp's serial number and details
         * TODO: Step 1: Find the current serial of the RecommendedApp using the provided ID
         *        - Retrieve the RecommendedApp record and extract its current serial number
         * TODO: Step 2: Determine the new serial number for the RecommendedApp
         *        - If a new serial number is provided:
         *          - If the new serial is greater than the current serial:
         *            - Shift the serial numbers of recommendedApps between currentSerial+1 and targetSerial down by 1
         *          - If the new serial is less than the current serial:
         *            - Shift the serial numbers of recommendedApps between targetSerial and currentSerial-1 up by 1
         *        - If no new serial is provided:
         *          - Keep the same serial number as the current one
         * TODO: Update the RecommendedApp with the new serial number and the provided title, description, status, and updatedAt timestamp
         */
        try {
            const currentArticle = await prisma.recommendedApps.findUnique({
                where: { id: parseInt(params.id) },
            });
            const currentSerial = currentArticle.serial;

            let targetSerial;

            if (newSerial != "") {
                targetSerial = newSerial;

                if (targetSerial > currentSerial) {
                    await prisma.recommendedApps.updateMany({
                        where: {
                            serial: {
                                gt: currentSerial,
                                lte: targetSerial,
                            },
                        },
                        data: {
                            serial: {
                                decrement: 1,  // decrement the serial by 1
                            },
                        },
                    });
                }
                else if (targetSerial < currentSerial) {
                    await prisma.recommendedApps.updateMany({
                        where: {
                            serial: {
                                gte: targetSerial,
                                lt: currentSerial,
                            },
                        },
                        data: {
                            serial: {
                                increment: 1,  // increment the serial by 1
                            },
                        },
                    });
                }
            }
            else {
                targetSerial = currentSerial;
            }

            await prisma.recommendedApps.update({
                where: { id: parseInt(params.id) },
                data: {
                    serial: parseInt(targetSerial),
                    name: name,
                    image: imageDir,
                    url: url,
                    description: description,
                    validity: validity,
                    status: status,
                    updatedAt: new Date()
                }
            });
            return {
                target: "success",
                message: "RecommendedApp has been updated Successfully",
                data: [],
            }
        } catch (error) {
            createActivityLog({type: "error", shop: "support", subject: "RecommendedApp update", body: error});
            return {
                target: "critical",
                message: "RecommendedApp creation failed please try again !!",
                data: [],
            }
        }
    }
}

export default function RecommendedAppEdit() {
    const loaderData = useLoaderData() || {};
    const actionData = useActionData() || {};
    const submit = useSubmit();
    const navigate = useNavigate();

    const [pageLoader, setPageLoader] = useState(true);
    const [formLoader, setFormLoader] = useState(false);
    const [RecommendedAppNotFound, SetRecommendedAppNotFound] = useState(false);
    const [displayRecommendedApp, setDisplayRecommendedApp] = useState(false);
    const [readyToRedirect, setReadyToRedirect] = useState(false);
    const validImageTypes = ['image/gif', 'image/jpeg', 'image/png'];

    const [formState, setFormState] = useState({
        serial: "",
        name: "",
        image: "",
        url: "",
        description: "",
        validity: "",
        status: "ACTIVE",
        oldImage: ""
    });
    const [formError, setFormError] = useState({
        serial: "",
        name: "",
        image: "",
        url: "",
        description: "",
        validity: "",
        status: "",
    });

  const formatDate = (date) => {
      date = new Date(date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0'); // getMonth() returns month from 0-11
      const day = String(date.getDate()).padStart(2, '0');
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      hours = String(hours).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}`
  }

    if(loaderData?.target == "RecommendedAppInfo") {
        if(pageLoader) {
            if(loaderData?.data?.id) {
              const formattedDate = loaderData?.data?.validity ? formatDate(loaderData?.data?.validity): "";
                setFormState({
                    serial: loaderData.data.serial,
                    name: loaderData.data.name,
                    oldImage: loaderData.data.image,
                    url: loaderData.data.url,
                    description: loaderData.data.description,
                    validity: formattedDate,
                    status: loaderData.data.status,
                })
            }
            else {
                SetRecommendedAppNotFound(true);
            }
            setPageLoader(false);
        }
    }

    const handleSerialChange = (newValue) => {
        setFormState({ ...formState, serial: newValue });
    }
    const handleNameChange = (newValue) => {
        setFormState({ ...formState, name: newValue });
    }
    const handleStatusChange = (newValue) => {
        setFormState({ ...formState, status: newValue });
    }
    const handleUrlChange = (newValue) => {
        setFormState({ ...formState, url: newValue });
    }
    const handleValidityChange = (newValue) => {
        setFormState({ ...formState, validity: newValue });
    }
    const handleDescriptionChange = (newValue) => {
        setFormState({ ...formState, description: newValue });
    }
    const handleUploadImage = () => {
        setFormState({ ...formState, image: undefined });
    }

    // After submit data "submitForm" function send all formData to the action
    const submitForm = async () => {
        setFormLoader(true);
        let validated = true;
        const errorMessages = {};
        // Form validation
        if(!formState.name || formState.name == "") {
            errorMessages.name = "Name is required";
            validated = false;
        }
        if (formState?.image?.size != "" && formState?.image?.size > 2000000) {
            errorMessages.image = "Image  size not more than 2 mb";
            validated = false;
        }
        if (formState?.image != undefined && !validImageTypes.includes(formState?.image?.type)) {
            errorMessages.image = "Only .jpg, .png, .gif are allowed";
            validated = false;
        }
        if (!formState.url || formState.url == "") {
            errorMessages.url = "URL is required";
            validated = false;
        }
        if (!formState.validity || formState.validity == "") {
            errorMessages.validity = "Validity is required";
            validated = false;
        }
        if (!formState.description || formState.description == "") {
            errorMessages.description = "Description is required";
            validated = false;
        }
        if(!formState.status || formState.status == "") {
            errorMessages.status = "Status is required";
            validated = false;
        }

        if(validated) {
            const formData = new FormData();
            formData.append("name", formState.name);
            formData.append("file", formState.image);
            formData.append("oldImage", formState.oldImage);
            formData.append("url", formState.url);
            formData.append("validity", formState.validity);
            formData.append("description", formState.description);
            formData.append("status", formState.status);
            formData.append("target", "update-recommended-app");
            submit(formData , { method: "POST", encType:"multipart/form-data" });
            setDisplayRecommendedApp(true);
        }
        else {
            setFormError({ ...errorMessages });
            setFormLoader(false);
        }
    }
    /**
     * These options are used for RecommendedApp status select
     * All values are pre-defined in database
     */
    const statusOptions = [
        { label: 'Active', value: 'ACTIVE' },
        { label: 'Inactive', value: 'INACTIVE' },
    ];

    /**
     * If form submit successfully ,then the form will be reset
     */
    if (actionData?.target) {
        if(actionData?.target == "success") {
            if(!readyToRedirect) {
                setReadyToRedirect(true);
            }
        }
        if(formLoader) {
            setFormLoader(false);
        }
    }

    // Hide article display
    const handleBanner = () => {
        setDisplayRecommendedApp(false);
    }

    useEffect(() => {
        if(readyToRedirect) {
            navigate("/supports/recommended-apps");
        }
    }, [readyToRedirect]);

  const handleDropZoneDrop = useCallback((_dropFiles, acceptedFiles, _rejectedFiles) =>
    setFormState((prevFormState) => ({
        ...prevFormState,
        image: acceptedFiles[0]
    })), [])

  const fileUpload = !formState?.image?.length && (
      <DropZone.FileUpload actionHint="Accepts .gif, .jpg, and .png" />
  );

  const uploadedFiles = formState?.image != "" && (
    <Card vertical >
      <Grid>
        <Grid.Cell columnSpan={{ xs: 12, sm: 6, md: 6, lg: 12, xl: 12 }}>
          <Card alignment="center">
            {formState?.image == undefined ? (
              <>
                  <Thumbnail
                      size="medium"
                      alt={formState?.image?.name}
                      source={formState.oldImage}
                  />
              </>
          ) : (
                <>
                    <InlineStack align="end">
                        <Button variant="plain" tone="critical" icon={XCircleIcon} onClick={handleUploadImage}></Button>
                    </InlineStack>

                    <Thumbnail
                        size="medium"
                        alt={formState?.image?.name}
                        source={validImageTypes.includes(formState?.image?.type) ? window.URL.createObjectURL(formState?.image) : NoteIcon }
                    />
                </>
              )}
            <div>
                {formState?.image?.name}{' '}
                <Text variant="bodySm" as="p">
                    {formState?.image?.size} bytes
                </Text>
            </div>
          </Card>
        </Grid.Cell>
      </Grid>
    </Card>
  );

    return (
        <Page title="Edit RecommendedApp">
            {pageLoader ? (
                <Card padding={600}>
                    <Grid>
                    <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                            <BlockStack gap="300">
                                <Text as="h1" variant="headingSm">name</Text>
                                <SkeletonDisplayText maxWidth='100%' />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={300}>
                                <Text as="h1" variant="headingSm">URl</Text>
                                <SkeletonDisplayText maxWidth='100%' />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap="300">
                                <Text as="h1" variant="headingSm">Serial</Text>
                                <SkeletonDisplayText maxWidth='100%' />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap="300">
                                <Text as="h1" variant="headingSm">Validity</Text>
                                <SkeletonDisplayText maxWidth='100%' />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap="300">
                                <Text as="h1" variant="headingSm">Image upload</Text>
                                <SkeletonDisplayText maxWidth='100%' />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap="300">
                                <Text as="h1" variant="headingSm">Status</Text>
                                <SkeletonDisplayText maxWidth='100%' />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap="300">
                                <Text as="h1" variant="headingSm">Description</Text>
                                <SkeletonDisplayText maxWidth='100%' />
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <Button variant="primary" size="large" disabled>
                                Submit
                            </Button>
                        </Grid.Cell>
                    </Grid>
                </Card>
            ): RecommendedAppNotFound ? (
                <Card padding={600}>
                    <EmptyState
                        heading="RecommendedApp not found!"
                        fullWidth={true}
                        action={{
                            content: "Create RecommendedApp",
                            url: "/supports/recommended-apps/new"
                        }}
                        secondaryAction={{
                            content: "RecommendedApp list",
                            url: "/supports/recommended-apps/"
                        }}
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                        <p>Sorry! the RecommendedApp you are looking for was not found.</p>
                    </EmptyState>
                </Card>
            ) : (
                <BlockStack gap={300}>
                    {displayRecommendedApp && actionData?.message &&
                        <Banner title={actionData?.message} tone={actionData?.target} onDismiss={handleBanner} />
                    }
                    <Card padding={600}>
                        <Grid>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                            <BlockStack gap={200}>
                                <Text as="h1" variant="headingSm">Name</Text>
                                <TextField type="text" placeholder="Name" onChange={handleNameChange} value={formState.name} />
                                {formError.name && (
                                    <Text as="p" tone="critical">{formError.name}</Text>
                                )}
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                            <BlockStack gap={200}>
                                <Text as="h1" variant="headingSm">URL</Text>
                                <TextField type="text" placeholder="URL" onChange={handleUrlChange} value={formState.url} />
                                {formError.url && (
                                    <Text as="p" tone="critical">{formError.url}</Text>
                                )}
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={200}>
                                <Text as="h1" variant="headingSm">Serial</Text>
                                <TextField type="number" placeholder="Serial" onChange={handleSerialChange} value={formState.serial} min={1} />
                                {formError.serial && (
                                    <Text as="p" tone="critical">{formError.serial}</Text>
                                )}
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={200}>
                                <Text as="h1" variant="headingSm">Validity</Text>
                                <TextField type="datetime-local" placeholder="Serial" onChange={handleValidityChange} value={formState.validity}/>
                                {formError.validity && (
                                    <Text as="p" tone="critical">{formError.validity}</Text>
                                )}
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={200}>
                                <Text as="h1" variant="headingSm">Image upload</Text>
                                  {uploadedFiles}
                                  <DropZone onDrop={handleDropZoneDrop} type="image" accept="image/png, image/gif, image/jpeg" variableHeight>
                                    {formState.image?.length > 0 &&
                                      <InlineStack align="center">
                                        <Button variant="plain" >add_files</Button>
                                      </InlineStack>
                                    }
                                    {fileUpload}
                                  </DropZone>
                                {formError.image && (
                                    <Text as="p" tone="critical">{formError.image}</Text>
                                )}
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 6 }}>
                            <BlockStack gap={200}>
                                <Text as="h1" variant="headingSm">Status</Text>
                                <Select options={statusOptions} onChange={handleStatusChange} value={formState.status} />
                                {formError.status && (
                                    <Text as="p" tone="critical">{formError.status}</Text>
                                )}
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                            <BlockStack gap={200}>
                                <Text as="h1" variant="headingSm">Description</Text>
                                <TextField
                                    type="text"
                                    placeholder="Description"
                                    multiline={4}
                                    autoComplete="off"
                                    onChange={handleDescriptionChange}
                                    value={formState.description}
                                    helpText="Enter actual HTML text"
                                />
                                {formError.description && (
                                    <Text as="p" tone="critical">{formError.description}</Text>
                                )}
                            </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, lg: 12 }}>
                            <InlineStack align="end">
                                <Button variant="primary" size="large" onClick={() => submitForm()} loading={formLoader}>Submit</Button>
                            </InlineStack>
                        </Grid.Cell>
                    </Grid>
                    </Card>
                </BlockStack>
            )}
        </Page>
    );
}
