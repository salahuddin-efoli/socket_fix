import { Box, Button, ButtonGroup, Grid, Text, TextField } from "@shopify/polaris";
import { XCircleIcon, SearchIcon } from "@shopify/polaris-icons";
import { useCallback, useState } from "react";
import SelectionModalMin from "./modal/SelectionModalMin";
import { useTranslation } from "react-i18next";

export default function ProductVendors({ productVendors, handleIncludeVendor, removeVendor }) {
    const { t } = useTranslation();
    const [addVendor, setaddVendor] = useState("");
    const [modalActive, setModalActive] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);

    const handleProductVendors = () => {
        setSelectedItems(productVendors)
        setModalActive(true);
    }  

    /**
     *After click select button all selected items  pass  to the "handleIncludeVendor" and
     * "handleIncludeVendor" set the value to the includeTags state
     */
    const addProductVendors = (newItem) => {
        setSelectedItems(newItem); 
        handleIncludeVendor(newItem);
        setModalActive(!modalActive);
    }

    const handleInputVendor = (newItem)=>{
        setaddVendor(newItem);
        handleProductVendors()
    }

    const closeModal = () => {
        setModalActive(false);
    }

    return (
        <>
            <Text as="h1" variant="headingSm">{ t("vendors") }</Text>
            <Grid>
                <Grid.Cell columnSpan={{ xs: 4, lg: 8 }}>
                    <TextField
                        type="text"
                        placeholder={ t("browse_item", { item: t("vendors").toLocaleLowerCase()}) }
                        value={addVendor}
                        onFocus={() => handleInputVendor("")}
                        autoComplete="off"
                    />
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 2, lg: 2 }}>
                    <Button
                        icon={SearchIcon}
                        size="large"
                        onClick={handleProductVendors}
                    />
                </Grid.Cell>
            </Grid>
            {productVendors && productVendors.length > 0 && (
            <ButtonGroup>
                {productVendors.map((item, index) => (
                    <Button
                        key={index}
                        icon={XCircleIcon}
                        onClick={() => removeVendor(item)} >
                        {item}
                    </Button>
                ))}
            </ButtonGroup>
            )}

            {modalActive && (
                <SelectionModalMin
                    showModal={modalActive}
                    target={"productVendor"}
                    parentKeyword={addVendor}
                    preSelectedItems={selectedItems}
                    getSelectedData={addProductVendors}
                    onCancel={closeModal}
                />
            )}
        </>
    );
}