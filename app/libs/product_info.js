import { authenticate } from "../shopify.server";

export const productInfoById = async (id) => {
    const { admin } = await authenticate.admin(request);
    const query = `{
            product(id: "${id}") {
                id
                title
                description
                images(first:1){
                edges{
                        node{
                            id,
                            url
                        }
                    }
                }
                options{
                    id
                    values
                }
                variants(first:100){
                    edges{
                        node{
                        id
                        title
                        inventoryQuantity
                        price
                        }
                    }
                }
            }
            
        }`;

    const response = await admin.graphql(query);
    const data = await response.json();
    return data;
}