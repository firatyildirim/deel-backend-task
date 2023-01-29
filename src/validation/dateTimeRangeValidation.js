const {query} = require("express-validator");
const dateTimeRangeValidation = () => {
    const validations = [];
    validations.push(query('start')
            .exists()
            .isISO8601()
            .toDate(),
        query('end')
            .exists()
            .isISO8601()
            .custom((value, {req}) => {
                if (new Date(value) <= new Date(req.query.start)) {
                    throw new Error('End date of lab must be valid and after start date');
                }
                return true;
            })
            .toDate())

    return validations;
}
module.exports = {dateTimeRangeValidation}