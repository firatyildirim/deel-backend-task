const swaggerAutogen = require('swagger-autogen')()

const outputFile = './swagger_output.json'
const endpointsFiles = ['./src/app.js']
const doc = {
    info: {
        version: "1.0.0",
        title: "Deel",
        description: "Deel Backend Task"
    },
    host: "localhost:3001",
    basePath: "/",
    schemes: ['http', 'https'],
    consumes: ['application/json'],
    produces: ['application/json'],
    tags: [
        {
            "name": "Contracts",
            "description": "Contract Fetch Operations"
        },
        {
            "name": "Job",
            "description": "Job Fetch and Update Operations"
        },
        {
            "name": "Balance",
            "description": "Balance Altering operations"
        },
        {
            "name": "Admin",
            "description": "Generate Reports"
        }
    ],
    securityDefinitions: {
        profile_id: {
            type: "apiKey",
            name: "profile_id",
            in: "header"
        }
    }
}
swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
    require('./src/app.js')
})