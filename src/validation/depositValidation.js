const {sequelize} = require("../model");
const {Op} = require("sequelize");
const depositValidation = async (amount, {req}) => {
    if (amount <= 0) {
        return Promise.reject();
    }
    const {Job, Profile, Contract} = req.app.get('models')
    const {userId} = req.params
    const profile = await Profile.findOne({
        attributes: [
            'id',
            'balance',
            [sequelize.fn('SUM', sequelize.col('price')), 'total_price']
        ],
        include: {
            model: Contract,
            as: 'Client',
            include: {
                model: Job,
                where: {
                    [Op.or]: [
                        {paid: 0},
                        {paid: null}
                    ]
                }
            }
        },
        where: {id: userId}
    });
    if (amount / profile.dataValues.total_price > 1.25) {
        return Promise.reject();
    }
    req.profile = profile;
    return true;
}

module.exports = {depositValidation}