import { BlockStack, Button, Banner, Card, Page, Select, Text, TextField, Grid, InlineStack, DropZone } from '@shopify/polaris';
import { NoteIcon } from "@shopify/polaris-icons";
import { useEffect, useState, useCallback } from 'react';
import { redirect, useActionData, useSubmit } from '@remix-run/react';
import prisma from '../../../db.server';
import { authenticator } from "../../../services/auth.server";
import { createActivityLog, getUserAccess } from '../../../libs/helpers';
import { unstable_composeUploadHandlers, unstable_parseMultipartFormData, unstable_createFileUploadHandler, unstable_createMemoryUploadHandler } from "@remix-run/node";
import path from 'path';

export const loader = async ({ request }) => {
    const currentAgent = await getUserAccess(request, authenticator, prisma);

    // If current agent do not have access to create operation, redirect him to list page
    if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("RAPP_CRT")) {
        return redirect("/supports/recommended-apps");
    }
    // Else proceed to regular operations
    return {}
};

export const action = async ({ request }) => {
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
                  // Create a unique name for the file
                  const uniqueSuffix = `${Date.now()}`;
                  const extension = path.extname(filename);
                  return `${uniqueSuffix}${extension}`;
                  //return filename;
                },
            }),
            unstable_createMemoryUploadHandler(),
        ),
    );

    const target = formdata.get('target') || "";

    // Store recommended app basic  info to the DB
    if (target == "create-recommended-app") {
        const currentAgent = await getUserAccess(request, authenticator, prisma);

        // If current agent do not have access to create operation, redirect him to list page
        if(currentAgent.role != "ADMIN" && !currentAgent.permissions.includes("RAPP_CRT")) {
            return {
                target: "critical",
                message: "You do not have permission to perform this operation",
                data: [],
            }
        }
        // Else proceed to regular operations

        const file = formdata.get('file') || "";
        const imageDir = "/images/"+ file?.name;
        const serial = formdata.get('serial') ? parseInt(formdata.get('serial')) : "";
        const name = formdata.get('name') || "";
        const url = formdata.get('url') || "";
        const description = formdata.get('description') || "";
        const validity = formdata.get('validity') ? new Date(formdata.get('validity')).toISOString() : "";
        const status = formdata.get('status') || "";

        /**
         * * Insert a new RecommendedApp with the appropriate serial number
         * TODO: Initialize the new serial number to 1 by default
         * TODO: If a specific serial number is provided:
         *        - Shift existing RecommendedApps down by one position to make room for the new RecommendedApp
         *        - Update the serial numbers of RecommendedApps that are greater than or equal to the provided serial
         *        - Set the new serial number to the provided value
         * TODO: If no specific serial number is provided:
         *        - Find the current maximum serial number among existing RecommendedApps
         *        - Set the new serial number to maxSerial + 1, or 1 if no RecommendedApps exist
         * TODO: Create the new RecommendedApp with the determined serial number and provided name, image, and status
         */
          try {
              let newSerial = 1;
              if (serial != "") {
                  await prisma.recommendedApps.updateMany({
                      where: {
                          serial: {
                              gte: serial,  // greater than or equal to the new serial
                          },
                      },
                      data: {
                          serial: {
                              increment: 1,  // increment the serial by 1
                          },
                      },
                  });
                  newSerial = serial;
              }
              else {
                  // Find the maximum serial and set the new serial to max + 1
                  const maxSerial = await prisma.recommendedApps.aggregate({
                      _max: {
                          serial: true,
                      },
                  });
                  newSerial = (maxSerial._max.serial ?? 0) + 1; // If there are no records, start with serial 1
              }

              await prisma.recommendedApps.create({
                  data: {
                      serial: parseInt(newSerial),
                      name: name,
                      image: imageDir,
                      url: url,
                      description: description,
                      validity: validity,
                      status: status,
                  }
              });

              return {
                target: "success",
                message: "RecommendedApp has been created Successfully",
                data: [],
              }
        } catch (error) {
              createActivityLog({ type: "error", shop: "support", subject: "RecommendedApp create", body: error });
              return {
                target: "critical",
                message: "RecommendedApp creation failed please try again !!",
                data: [],
              }
        }
    }



}

export default function RecommendedAppCreate() {
    const actionData = useActionData() || {};
    const submit = useSubmit();
    const validImageTypes = ['image/gif', 'image/jpeg', 'image/png'];

    const [formLoader, setFormLoader] = useState(false);
    const [formState, setFormState] = useState({
        serial: "",
        name: "",
        image: "",
        url: "",
        description: "",
        validity: "",
        status: "ACTIVE",
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
    const [displayRecommendedApp, setDisplayRecommendedApp] = useState(false);

    useEffect(() => {
        setFormLoader(false)
    }, [formLoader])

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
        if (!formState.image || formState.image == "") {
            errorMessages.image = "Image  is required";
            validated = false;
        }
        if (formState.image.size > 2000000) {
            errorMessages.image = "Image  size not more than 2 mb";
            validated = false;
        }
        if (formState?.image != "" && !validImageTypes.includes(formState?.image?.type)) {
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
            formData.append("image", formState.image);
            formData.append("file", formState.image);
            formData.append("url", formState.url);
            formData.append("validity", formState.validity);
            formData.append("description", formState.description);
            formData.append("status", formState.status);
            formData.append("target", "create-recommended-app");
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
    useEffect(() => {
        if (actionData) {
            if (actionData.target == "success") {
                setFormState({ serial: "", name: "", image: "", status: "ACTIVE", validity: "" });
                setFormError({ serial: "", name: "", image: "", status: "", validity: "" })
            }
        }
    }, [actionData])

    // Hide article display
    const handleBanner = () => {
        setDisplayRecommendedApp(false);
    }


    const handleDropZoneDrop = useCallback((_dropFiles, acceptedFiles, _rejectedFiles)=>
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
        <Grid.Cell columnSpan={{ xs: 4, sm: 2, md: 2, lg: 4, xl: 4 }}>
          <Card alignment="center">
            <img
              alt=""
              width="100%"
              height="100%"
              src={
                  validImageTypes.includes(formState?.image.type)
                  ? window.URL.createObjectURL(formState?.image)
                  : NoteIcon
              }
            />
            <div>
              {formState?.image.name}{' '}
              <Text variant="bodySm" as="p">
                {formState?.image.size} bytes
              </Text>
            </div>
          </Card>
        </Grid.Cell>
      </Grid>
    </Card>
  );

    return (
        <Page title="Create RecommendedApp">
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
                                {/* <TextField type="text" placeholder="Image url" onChange={handleImageChange} value={formState.image} /> */}
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
        </Page>
    );
}
