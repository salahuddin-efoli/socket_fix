/**
 * 
 * @param body: A key value pair object of input field name and input field value
 * @param rules:  A key value pair object of input field name and input field validation rules. Each rules will be separated with a bar '|' sign. And parameter of ay rule will be saparated with a colon ':'.
 * @returns If all validations passes then NULL. If not then the error message with the field name and failed rule.
 * 
 */

let request = {};
const validator = (body, rules) => {
    request = { ...body };
    let validationResult = {};
    let errorFound = false;
    for (const fieldName in rules) {
        if (Object.hasOwnProperty.call(rules, fieldName)) {
            // Get the field value
            const fieldValue = body[fieldName] || '';
            // Get the rules set
            const rule = rules[fieldName];
            // Extract validation data
            const validations = functions.extractValidationData(rule);
            // Iterate over each rule
            for (let index = 0; index < validations.length; index++) {
                const validation = validations[index];
                // Call the corresponding validation function to validate the input value 
                const result = functions[validation[0]](fieldName, fieldValue, validation[1]);
                // If validation fails then break out of current itaration
                if(result) {
                    errorFound = true;
                    validationResult[fieldName] = result;
                    break;
                }
            }
        }
    }
    // Return validation info
    return {error: errorFound, messages: validationResult};
};

// All the rules functions
const functions = {};

functions.required = (field, value) => {
    if(!value || value == null || value.length == 0) {
        return {i18n_key: "field_required", i18n_properties: {field}};
    }
    return null;
};
functions.requiredIf = (field, value, parameter) => {
    parameter = parameter.split(",");
    const paramField = parameter[0];
    const paramValue = parameter[1];
    if((paramValue == request[paramField].toString()) && (!value || value == null || value.length == 0)) {
        return {i18n_key: "field_required_when_field2_is_parameter", i18n_properties: {field: field, field2: paramField, parameter: paramValue}};
    }
    return null;
};
functions.string = (field, value) => {
    if(value && typeof value != 'string') {
        return {i18n_key: "field_must_be_string", i18n_properties: {field}};
    }
    return null;
};
functions.number = (field, value) => {
    if(value && typeof value != 'number') {
        return {i18n_key: "field_must_be_number", i18n_properties: {field}};
    }
    return null;
};
functions.array = (field, value) => {
    if(value && !Array.isArray(value)) {
        return {i18n_key: "field_must_be_array", i18n_properties: {field}};
    }
    return null;
};
functions.minValue = (field, value, parameter) => {
    if(!value || value < parameter) {
        return {i18n_key: "field_must_be_greater_or_equal_than_parameter", i18n_properties: {field, parameter}};
    }
    return null;
};
functions.maxValue = (field, value, parameter) => {
    if(!value || value > parameter) {
        return {i18n_key: "field_must_be_smaller_or_equal_than_parameter", i18n_properties: {field, parameter}};
    }
    return null;
};
functions.minLength = (field, value, parameter) => {
    if(!value || value.length < parameter) {
        return {i18n_key: "field_must_be_at_least_parameter_characters_long", i18n_properties: {field, parameter}};
    }
    return null;
};
functions.maxLength = (field, value, parameter) => {
    if(!value || value.length > parameter) {
        return {i18n_key: "field_must_not_exceed_parameter_characters", i18n_properties: {field, parameter}};
    }
    return null;
};

// These is not rules
functions.extractValidationData = (validations) => {
    let validationData = [];
    validations = validations.split("|");
    validations.forEach(validation => {
        validationData.push(validation.split(":"));
    });
    return validationData;
}
functions.extractFieldName = (fieldName) => {
    let newFieldName = fieldName.replaceAll("_", " ");
    return newFieldName.charAt(0).toUpperCase() + newFieldName.slice(1);
}
export default validator;