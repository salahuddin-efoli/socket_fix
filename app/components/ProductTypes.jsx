import { Box, Button, ButtonGroup, Grid, Text, TextField } from "@shopify/polaris";
import { XCircleIcon, SearchIcon } from "@shopify/polaris-icons";
import { useCallback, useState } from "react";
import SelectionModalMin from "./modal/SelectionModalMin";
import { useTranslation } from "react-i18next";

export default function ProductTypes({ productTypes, handleIncludeType, removeType }) {
    const { t } = useTranslation();
    const [addType, setaddType] = useState("");
    const [modalActive, setModalActive] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);
    
    const handleProductTypes = () => {
        setSelectedItems(productTypes)
        setModalActive(true);
    } 

    /**
     *After click select button all selected items  pass  to the "handleIncludeType" and
     * "handleIncludeType" set the value to the ptoductType state
     */
    const addProductTypes = (newItem) => {
        setSelectedItems(newItem); 
        handleIncludeType(newItem);
        setModalActive(!modalActive);
    }

    const handleInputType = (newItem)=>{
        setaddType(newItem);
        handleProductTypes()
    }

    const closeModal = () => {
        setModalActive(false);
    }

    return (
        <>
            <Text as="h1" variant="headingSm">{ t("types") }</Text>
            <Grid>
                <Grid.Cell columnSpan={{ xs: 4, lg: 8 }}>
                    <TextField
                        type="text"
                        placeholder={ t("browse_item", { item: t("types").toLocaleLowerCase()}) }
                        value={addType}
                        onFocus={() => handleInputType("")}
                        autoComplete="off"
                    />
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 2, lg: 2 }}>
                    <Button
                        icon={SearchIcon}
                        size="large"
                        onClick={handleProductTypes}
                    />
                </Grid.Cell>
            </Grid>
            {productTypes && productTypes.length > 0 && (
            <ButtonGroup>
                {productTypes.map((item, index) => (
                    <Button
                        key={index}
                        icon={XCircleIcon}
                        onClick={() => removeType(item)}
                    >
                        {item}
                    </Button>
                ))}
            </ButtonGroup>
            )}

            {modalActive && (
                <SelectionModalMin
                    showModal={modalActive}
                    target={"productType"}
                    parentKeyword={addType}
                    preSelectedItems={selectedItems}
                    getSelectedData={addProductTypes}
                    onCancel={closeModal}
                />
            )}
        </>
    );
}