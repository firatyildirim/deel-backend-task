const express = require('express');
const bodyParser = require('body-parser');
const {sequelize} = require('./model')
const {getProfile} = require('./middleware/getProfile')
const {Op, Sequelize} = require("sequelize");
const {query, validationResult, body} = require("express-validator");
const {dateTimeRangeValidation} = require("./validation/dateTimeRangeValidation");
const {depositValidation} = require("./validation/depositValidation");
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../swagger_output.json');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/contracts/:id', getProfile, async (req, res) => {
    // #swagger.tags = ['Contracts']
    // #swagger.description = 'Get a contract with Id belong to authorized profile'
    /* #swagger.security = [{
               "profile_id": []
    }] */
    const {Contract} = req.app.get('models')
    const {id} = req.params
    const contract = await Contract.findOne({
        where: {
            id: id,
            [Op.or]: [
                {ContractorId: req.profile.dataValues.id},
                {ClientId: req.profile.dataValues.id}]
        }
    });
    if (!contract) return res.status(404).end()
    res.json(contract)
})

app.get('/contracts', getProfile, async (req, res) => {
    // #swagger.tags = ['Contracts']
    // #swagger.description = 'Returns a list of contracts belonging to a user (client or contractor), the list should only contain non terminated contracts.'
    /* #swagger.security = [{
               "profile_id": []
    }] */
    const {Contract} = req.app.get('models')
    const contracts = await Contract.findAll({
        where: {
            [Op.not]: {status: 'terminated'},
            [Op.or]: [
                {ContractorId: req.profile.dataValues.id},
                {ClientId: req.profile.dataValues.id}]
        }
    });
    if (!contracts) return res.status(404).end()
    res.json(contracts)
})

app.get('/jobs/unpaid', getProfile, async (req, res) => {
    // #swagger.tags = ['Job']
    // #swagger.description = 'Get all unpaid jobs for a user (either a client or contractor), for active contracts only.'
    /* #swagger.security = [{
               "profile_id": []
    }] */
    const {Job, Contract} = req.app.get('models')
    const jobs = await Job.findAll({
        include: {
            model: Contract,
            required: true,
            where: {
                [Op.not]: {status: 'terminated'},
                [Op.or]: [
                    {ContractorId: req.profile.dataValues.id},
                    {ClientId: req.profile.dataValues.id}]
            }
        },
        where: {
            paid: {[Op.is]: null}
        }
    });
    if (!jobs) return res.status(404).end()
    res.json(jobs)
})

app.post('/jobs/:job_id/pay', getProfile, async (req, res) => {
    // #swagger.tags = ['Job']
    // #swagger.description = 'Get all active contracts belong to authorized profile'
    /* #swagger.security = [{
               "profile_id": []
    }] */
    const {Job, Profile, Contract} = req.app.get('models')
    const {job_id} = req.params
    const job = await Job.findOne({
        include: {
            model: Contract,
            include: {
                model: Profile,
                as: 'Client'
            }
        },
        where: {
            id: job_id,
            [Op.or]: [
                {paid: 0},
                {paid: null}
            ]
        }
    });
    if (!job || job.Contract.ClientId !== req.profile.id)
        return res.status(400).send(
            {
                error: "Client cannot pay job that does not owned"
            }
        ).end()
    if (req.profile.balance < job.price)
        return res.status(400).send(
            {
                error: "Insufficient balance"
            }
        ).end()
    job.paid = true;
    req.profile.balance = req.profile.balance - job.price;

    const t = await sequelize.transaction();
    try {
        await job.save({transaction: t});
        await req.profile.save({transaction: t});

        await t.commit();
    } catch (err) {
        await t.rollback();
        res.status(500).send(err);
    }
    res.status(200).send();
})

app.post('/balances/deposit/:userId', [
        body('amount')
            .exists()
            .isFloat()
            .withMessage('amount must be a float')
            .toFloat()
            .custom(depositValidation)
            .withMessage('amount must be bigger then 0 and can not be bigger then 25% of all jobs to pay')
    ],
    // #swagger.tags = ['Balance']
    // #swagger.description = ' Deposits money into the the the balance of a client, a client can't deposit more than 25% his total of jobs to pay. (at the deposit moment)'
    /*  #swagger.parameters['obj'] = {
            in: 'body',
            schema: {
                amount: 'number'
            }
    } */
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({errors: errors.array()});
        }
        req.profile.balance += req.body.amount;
        const t = await sequelize.transaction();
        try {
            await req.profile.save({transaction: t});
            await t.commit();
        } catch (err) {
            await t.rollback();
            res.status(500).send(err);
        }
        res.status(200).send();
    })

app.get('/admin/best-profession', dateTimeRangeValidation(), async (req, res) => {
    // #swagger.tags = ['Admin']
    // #swagger.description = 'Returns the profession that earned the most money (sum of jobs paid) for any contactor that worked in the query time range.'
    /*  #swagger.parameters['start'] = {
        required: 'true',
        in: 'query',
        description: 'start',
        type: 'string',
        format: 'date-time'}
    */
    /*  #swagger.parameters['end'] = {
        required: 'true',
        in: 'query',
        description: 'end',
        type: 'string',
        format: 'date-time'}
    */
    const {Job, Contract, Profile} = req.app.get('models')
    const result = await Job.findOne({
        attributes: [
            [sequelize.col('Contract.Contractor.profession'), 'profession'],
            [sequelize.fn('SUM', sequelize.col('price')), 'total_price']
        ],
        include: {
            model: Contract,
            include: {
                model: Profile,
                as: 'Contractor'
            }
        },
        where: {
            paymentDate: {
                [Op.lt]: req.query.end,
                [Op.gt]: req.query.start
            }
        },
        group: ['Contract.Contractor.profession'],
        order: sequelize.literal('total_price DESC')
    });
    if (!result) return res.status(404).end();
    res.json({
        "profession": result.dataValues.profession,
        "total-earned": result.dataValues.total_price
    });
})

app.get('/admin/best-clients', [
    query('limit')
        .optional()
        .isInt({min: 1})
        .withMessage("limit must be decimal bigger then 0"),
    ...dateTimeRangeValidation()
], async (req, res) => {
    // #swagger.tags = ['Admin']
    // #swagger.description = 'returns the clients the paid the most for jobs in the query time period. limit query parameter should be applied, default limit is 2.'
    /*  #swagger.parameters['start'] = {
        required: 'true',
        in: 'query',
        description: 'start',
        type: 'string',
        format: 'date-time'}
    */
    /*  #swagger.parameters['end'] = {
        required: 'true',
        in: 'query',
        description: 'end',
        type: 'string',
        format: 'date-time'}
    */
    /*  #swagger.parameters['limit'] = {
        required: 'false',
        in: 'query',
        type: 'number',
        minimum: '0'
        }
    */
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({errors: errors.array()});
    }
    const {Job, Contract, Profile} = req.app.get('models')
    const jobs = await Job.findAll({
        attributes: [
            'id',
            [Sequelize.literal("firstName || ' ' || lastName"), 'fullName'],
            ['price', 'paid'],
        ],
        include: {
            model: Contract,
            include: {
                model: Profile,
                as: 'Client'
            }
        },
        where: {
            paymentDate: {
                [Op.lt]: req.query.end,
                [Op.gt]: req.query.start
            }
        },
        limit: req.query.limit || 2,
        order: [
            ['price', 'DESC']
        ]
    });
    if (!jobs) return res.status(404).end();
    res.json(jobs.map(x => {
        delete x.dataValues.Contract;
        return x.dataValues;
    }));
})

module.exports = app;
