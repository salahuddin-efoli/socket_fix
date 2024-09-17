/**
 ** Method to adjusts the datetime based on a timezone offset and returns it in ISO format or as a Date object.
 *  @param {number} timezoneOffset - Timezone offset in minutes from UTC.
 *  @param {string} dateString - Optional. Date string to adjust (default is current date/time).
 *  @param {boolean} iso - Optional. Whether to return the datetime in ISO string format (default true).
*/
export const getTimezonedDateTime = ({timezoneOffset, dateString = new Date().toString(), iso = true}) => {
    const tzOffsetDate = new Date(new Date(dateString).getTime() + (timezoneOffset * 60000));
    return iso ? tzOffsetDate.toISOString() : tzOffsetDate;
}

/**
 ** Method to format the datetime based on a timezone offset and returns the datetime or the date or the time.
 *  @param {number} timezoneOffset - Timezone offset in minutes from UTC.
 *  @param {string} dateString - Date string to format.
 *  @param {enum} returnType - Optional. Options: "dt", "d", "t". Whether to return the datetime or the date or the time.
*/
export const getFormattedDateTime = ({timezoneOffset, dateString, returnType = "dt"}) => {
    const tzOffsetDate = getTimezonedDateTime({timezoneOffset: timezoneOffset, dateString: dateString});

    const formattedDate = tzOffsetDate.split('T')[0];
    if(returnType == "d") {
        return formattedDate;
    }
    else if(returnType == "t" || returnType == "dt") {
        const newTime = tzOffsetDate.split('T')[1].substring(0,5);
        const splitTime = newTime.split(':');

        let hours = parseInt(splitTime[0]);
        const minutes = String(parseInt(splitTime[1])).padStart(2, '0');
        const meridiem = (hours < 12) ? 'AM' : 'PM';

        hours = (hours > 12) ? hours - 12 : hours;
        hours = (hours == 0) ? 12 : hours;

        const formattedTime = `${hours}:${minutes} ${meridiem}`;
        if(returnType == "t") {
            return formattedTime;
        }
        return `${formattedDate} ${formattedTime}`;
    }
}

export const timezoneOffsetDate = (date, reverse = false) => {
    // Get the offset depending on timezone
    const offset = new Date().getTimezoneOffset();
    // Check if we are showing date/time instead of saving
    // IF we are showing time then add the offset
    if(reverse) {
        return new Date(new Date(date).getTime() + (offset * 60 * 1000));
    }
    // Else substract the offset
    return new Date(new Date(date).getTime() - (offset * 60 * 1000));
};

export const getFormattedDate = (date, justString = true) => {
    if(justString) {
        return date.split('T')[0];
    }
    const newDate = new Date(date);
    return newDate.toISOString().split('T')[0];
};
export const getFormattedTime = (date) => {
    // Extract the time from the timestamp
    const newTime = date.split('T')[1].substring(0,5);

    // Split the time into hours and minutes
    const splitTime = newTime.split(':');
    let hours = parseInt(splitTime[0]);
    let minutes = parseInt(splitTime[1]);

    // Determine AM or PM
    const meridiem = (hours < 12) ? 'AM' : 'PM';

    // Convert hours to 12-hour format
    hours = (hours > 12) ? hours - 12 : hours;
    hours = (hours == 0) ? 12 : hours; // Handle midnight (00:00) as 12 AM

    // Add leading zero to minutes if necessary
    minutes = (minutes < 10) ? `0${minutes}` : minutes;

    // Return the formatted time
    return hours + ':' + minutes + ' ' + meridiem;
};

/**
 ** Method to store activity log in json file
 *  @param {string} type The type of log. This could be "info", "success", "error" and so on
 *  @param {string} shop This is the "my shopify domain" of current shop
 *  @param {string} subject This is the subject of this log, like a tagline.
 *  @param {object} body This is the log data. This could be an array, an object, a string or any other type of data
 *  @param {string} query If the log is for any GraphQL operation then this is the GraphQL query
 *  @param {string} variables If the log is for any GraphQL operation then this is the GraphQL variables
*/
export const createActivityLog = async ({type, shop = "discountray", subject, body = null, query = "", variables = ""}) => {
    const currentDate = new Date();
    const logDir = import.meta.env.VITE_ROOT_DIRECTORY 
                        + "/" + "logs" 
                        + "/" + currentDate.getFullYear() 
                        + "/" + (currentDate.getMonth() + 1) 
                        + "/" + currentDate.getDate() 
                        + "/" + currentDate.getHours() 
                        + "/" + shop;
    /**
     * The log file has a default name.
     * TODO: Depending on log type, set the proper file name
     */
    let fileName = "/discount-ray.log";
    if(type == "error") {
        fileName = "/error.log"
    }
    else if(type == "success") {
        fileName = "/success.log"
    }
    else if(type == "info") {
        fileName = "/info.log"
    }
    const filePath = logDir + fileName;

    // Get all the log data and make it a string
    const logData = JSON.stringify({ shop: shop, subject: subject, body: body, query: query, variables: variables });
    // Format this data along with current timestamp and log type
    const formattedLogData = `[${currentDate.toJSON()}] ${type.toUpperCase()}: ${logData}`;

    await fetch(import.meta.env.VITE_SHOPIFY_APP_URL + '/api/activity-log', {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ logDir: logDir, filePath: filePath, logData: formattedLogData })
    });
}

// Function to calculate remaining trial days after uninstalling and reinstalling the app
export const calculateRemainingTrialDays = (trialStartsAt, trialPeriod, withDetails = false) => {
    if(trialPeriod == null) {
        return null;
    }
    const usedTrialPeriod = trialStartsAt ? (new Date() - new Date(trialStartsAt)) : 0;
    const remainingMiliseconds = trialPeriod - usedTrialPeriod;
    
    // If "remainingMiliseconds" has negative or zero value, that means trial period has been used up and no trial is left
    if(remainingMiliseconds <= 0) {
        if(withDetails) {
            return {
                inNumbers: 0,
                inHours: "You have no trial period is left.",
                inSeconds: "You have no trial period is left.",
            }
        }
        return 0;
    }
    if(withDetails) {
        const remainingDays = Math.floor(remainingMiliseconds / (1000 * 60 * 60 * 24));
        const remainingHours = Math.floor((remainingMiliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const remainingMinutes = Math.floor((remainingMiliseconds % (1000 * 60 * 60)) / (1000 * 60));
        const remainingSeconds = Math.floor((remainingMiliseconds % (1000 * 60)) / 1000);

        return {
            days: remainingDays,
            hours: remainingHours,
            minutes: remainingMinutes,
            seconds: remainingSeconds,
            miliseconds: remainingMiliseconds,
        }
    }
    return remainingMiliseconds;
}

/**
 ** Generates an array of new price ranges for selected variants of a product, based on whether the product has changed or not.
 *  @param {Array} selectedVariants - An array of arrays, where each inner array represents a selected variant of a product. Each variant object is expected to have at least 'id', 'title', and 'price' properties.
 *  @param {Array} existingVariants - An array of existing variant objects, where each variant object is expected to have at least 'id', 'title', 'old_price', and 'prices' properties. The 'prices' property should be an array of price objects.
 *  @param {boolean} productChanged - A boolean flag indicating whether the product has changed or not.
 *  @returns {Array} new_ranges - An array of objects representing the new price ranges for each selected variant.
 *
 *  TODO: Initializes an empty array `new_ranges` to store the new price ranges.
 *  TODO: Iterates over each variant in the `selectedVariants` array.
 *  TODO: If the `productChanged` flag is true, add a new price range object
 *  TODO: If the `productChanged` flag is false:
 *    1. Searches for an object in `existingVariants` with the same id as the current variant.
 *    2. If a matching object is found, add a new price range object to `new_ranges` but the prices will be a copy of the `prices` array from the found object.
 *    3. If no matching object is found:
 *      a. Initializes an empty array `new_prices`.
 *      b. If the first object in `existingVariants` has a non-empty `prices` array:
 *        i. Iterates over the `prices` array of the first object in `existingVariants`.
 *        ii. Adds a new price object to `new_prices` for each price object in the `prices` array of the first object in `existingVariants`, where "quantity" is the quantity from the current price object
 *      c. If the first object in `existingVariants` has an empty `prices` array, add an empty single price object to `new_prices`
 *      d. Adds a new price range object to `new_ranges` with the following properties:
 *        - `id`: The id of the current variant.
 *        - `title`: The title of the current variant.
 *        - `old_price`: The price of the current variant.
 *        - `prices`: The `new_prices` array.
 *  TODO: Returns the `new_ranges` array containing the new price ranges for all selected variants.
 */
export const getNewRangesOnVariantUpdate = (selectedVariants, existingVariants, productChanged = false) => {
    const new_ranges = [];
    for (let index = 0; index < selectedVariants.length; index++) {
        const variant = selectedVariants[index];
        if(productChanged) {
            new_ranges.push({
                id: variant.id,
                title: variant.title,
                old_price: variant.price,
                prices: [{ id: new Date().getTime(), quantity: 1, price: 0 }]
            });
        }
        else {
            const foundObject = existingVariants.find(obj => obj.id == variant.id);
            if(foundObject) {
                new_ranges.push({
                    id: variant.id,
                    title: variant.title,
                    old_price: variant.price,
                    prices: [...foundObject.prices]
                });
            }
            else {
                let new_prices = [];
                if(existingVariants[0]?.prices.length > 0) {
                    for (let j = 0; j < existingVariants[0]?.prices.length; j++) {
                        new_prices.push({ id: new Date().getTime(), quantity: existingVariants[0].prices[j].quantity, price: 0 });
                    }
                }
                else {
                    new_prices.push({ id: new Date().getTime(), quantity: 1, price: 0 });
                }
                new_ranges.push({
                    id: variant.id,
                    title: variant.title,
                    old_price: variant.price,
                    prices: new_prices
                });
            }
        }
    }
    return new_ranges;
}

export const extractIdFromShopifyUrl = (url) => {
	// Regular expression to match the pattern gid://shopify/DiscountAutomaticNode/ followed by digits
	const regex = /gid:\/\/shopify\/DiscountAutomaticNode\/(\d+)/;
	const match = url.match(regex);

	// Check if there's a match
	if (match) {
		// Extract the captured group (digits) and return it
		return match[1];
	} else {
		// Handle the case where the URL doesn't match the pattern
		return null; // Or you can throw an error if preferred
	}
}

export const defaultCssStyle = `
.dr-discountInfoTable {
  width: 100%;
  font-family: Arial, Helvetica, sans-serif;
  border-collapse: collapse;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: background-color 0.2s ease;
}
.dr-discountInfoTable td, #dr-discountInfoTable th {
  border: 1px solid #ddd;
  padding: 10px;
}
.dr-discountInfoTable tr{
  transition: background-color 0.2s ease;
}
.dr-discountInfoTable tr:nth-child(even){
  background-color: #eee;
}
.dr-discountInfoTable tr:hover {
  background-color: #f5f5f5;
}
.dr-discountInfoTableTdDiscountValue {
 	font-size: 18px;
	color:red;
}
.dr-discountInfoTable th {
  padding: 10px;
  text-align: left;
  background-color: #04AA6D;
  color: white;
}

.dr-discountInfoList {
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 5px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.dr-discountInfoListItem {
  padding: 10px;
  border-bottom: 1px solid #ddd;
  transition: background-color 0.2s ease;
}
.dr-discountInfoListItem:last-child {
  border-bottom: none;
}
.dr-discountInfoListItem:hover {
  background-color: #f5f5f5;
}
.dr-discountInfoListItemDiscount {
  font-size: 18px;
  color:red;
}`;

export const getUserAccess = async (request, authenticator, prisma) => {
    const userEmail = await authenticator.isAuthenticated(request);

    const currentUser = await prisma.supportAgents.findFirst({
        select: {
            id: true,
            role: true,
            permissions: true,
        },
        where: {
            email: userEmail
        }
    });

    if(currentUser) {
        return {
            id: currentUser.id,
            role: currentUser.role,
            permissions: currentUser.permissions ? JSON.parse(currentUser.permissions) : []
        }
    }
    return {
        id: "",
        role: "",
        permissions: []
    }
}