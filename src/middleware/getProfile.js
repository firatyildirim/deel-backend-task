const getProfile = async (req, res, next) => {
    const profileId = req.get('profile_id');
    if (!profileId) {
        res.status(401).end();
    }
    const {Profile} = req.app.get('models')
    const profile = await Profile.findOne({where: {id: profileId || 0}})
    if (!profile) return res.status(401).end()
    req.profile = profile
    next()
}
module.exports = {getProfile}


