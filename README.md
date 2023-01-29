# DEEL BACKEND TASK

`http://localhost:3001/api-docs` under this link Swagger is hosted

### Added Dependencies
1. `express-validator` - For request validations
1.  `swagger-ui-express` - To host Swagger API documentation
1.  `swagger-autogen` - Generates Swagger file

### Scripts
Recreate Swagger file execute ` npm run swagger-autogen` command 

### Notes

- I had to update sqlite3 dependency to the most recent version because of an error
- All request and business logics defined under `app.js`
- Added some custom validation for business rules under `validation` folder
