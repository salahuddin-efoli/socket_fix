import { Box, Button, ButtonGroup, Grid, Text, TextField } from "@shopify/polaris";
import { XCircleIcon, SearchIcon } from "@shopify/polaris-icons";
import { useCallback, useState } from "react";
import SelectionModalMin from "./modal/SelectionModalMin";
import { useTranslation } from "react-i18next";


export default function IncludeTags({ tags, handleTags, removeTag, excludeTag=false }) {
    const { t } = useTranslation();
    const [addTag, setAddTag] = useState("");
    const [modalActive, setModalActive] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);

    /**
     * "handleProductTags function retrive all product tag"
     */
    const handleProductTags = () => {
        setSelectedItems(tags)
        setModalActive(true);
    }

    /**
     * After click select button all selected items  pass  to the "handleTags" and
     * "handleTags" set the value to the tags state
     */
    const addIncludeTags = (newItem) => {
        setSelectedItems(newItem);
        handleTags(newItem);
        setModalActive(false);
    }

    const handleInputTag = (newItem) => {
        setAddTag(newItem);
        handleProductTags()
    }

    const closeModal = () => {
        setModalActive(false);
    }

    return (
        <>
            
            <Text as="h1" variant="headingSm">{ t("tags") }</Text>
            <Grid>
                <Grid.Cell columnSpan={{ xs: 4, lg: 8 }}>
                    <TextField
                        type="text"
                        placeholder={ t("browse_item", { item: t("tags").toLocaleLowerCase()}) }
                        value={addTag}
                        onFocus={() => handleInputTag("")}
                        autoComplete="off"
                    />
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 2, lg: 2 }}>
                    <Button
                        icon={SearchIcon}
                        size="large"
                        onClick={handleProductTags}
                    />
                </Grid.Cell>
            </Grid>
            {tags && tags.length > 0 && (
            <ButtonGroup>
                {tags.map((item, index) => (
                    <Button
                        key={index}
                        icon={XCircleIcon}
                        onClick={() => removeTag(item)}
                    >
                        {item}
                    </Button>
                ))}
            </ButtonGroup>
            )}

            {modalActive && (
                <SelectionModalMin
                    showModal={modalActive}
                    target={"productTags"}
                    parentKeyword={addTag}
                    preSelectedItems={selectedItems}
                    getSelectedData={addIncludeTags}
                    onCancel={closeModal}
                />
            )}
        </>
    );
}