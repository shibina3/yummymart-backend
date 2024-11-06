const { userData } = require('../data/db_client');

module.exports = {
    register_routes: (app) => {
        app.post('/register/user', async (req, res) => {
            try {
                const user = req.body;
                const result = await userData.registerUser(user);
                res.status(201).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/login/user', async (req, res) => {
            try {
                const { email, password } = req.body;
                const user = await userData.getUserByEmail(email);
                if (user.password === password) {
                    res.status(200).send(user);
                } else {
                    res.status(401).send('Invalid password');
                }
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/deregister/user', async (req, res) => {
            try {
                const { email } = req.body;
                const result = await userData.deRegisterUser(email);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });
    }
}