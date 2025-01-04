const { userData } = require('../data/db_client');

module.exports = {
    register_routes: (app) => {
        app.post('/user/onboarding', async (req, res) => {
            try {
                const user = req.body;
                const result = await userData.registerUser(user);
                res.status(200).send(result);
            } catch (error) {
                console.log("Error: ", error);
                res.status(500).send(error);
            }
        });

        app.post('/login/user', async (req, res) => {
            try {                
                const { emailOrMob, password } = req.body;
                const user = await userData.getUserByEmailOrMob(emailOrMob);
                
                if (user.password === password) {
                    res.status(200).send(user);
                } else {
                    res.status(401).send('Invalid password');
                }
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/send/otp', async (req, res) => {
            try {
                const { mobile } = req.body;
                // await userData.sendOTP(mobile);
                res.status(200).send('OTP sent successfully');
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/verify/otp', async (req, res) => {
            try {
                const { mobile, otp } = req.body;
                const result = await userData.verifyOTP(mobile, otp);
                res.status(200).send(result);
            } catch (error) {
                console.log("Error: ", error);
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

        app.post('/get/user', async (req, res) => {
            try {
                const { mobile } = req.body;
                const result = await userData.getUserByEmailOrMob(mobile);
                res.status(200).send(result);
            } catch (error) {
                console.log("Error: ", error);
                res.status(500).send(error);
            }
        });

        app.post('/register/seller', async (req, res) => {
            try {
                const seller = req.body;
                const result = await userData.registerSeller(seller);
                res.status(200).send(result);
            } catch (error) {
                console.log("Error: ", error);
                res.status(500).send(error);
            }
        });

        app.post('/get/user-type', async (req, res) => {
            try {
                const { mobile } = req.body;
                const result = await userData.getUserType(mobile);
                res.status(200).send(result);
            } catch (error) {
                console.log("Error: ", error);
                res.status(500).send(error);
            }
        });

        app.post('/get/submitted-sellers', async (req, res) => {
            try {
                const result = await userData.getSubmittedSellers();
                res.status(200).send(result);
            } catch (error) {
                console.log("Error: ", error);
                res.status(500).send(error);
            }
        });

        app.post('/get/seller-submitted-details', async (req, res) => {
            try {
                const { mobile } = req.body;
                const result = await userData.getSellerSubmittedDetails(mobile);
                res.status(200).send(result);
            } catch (error) {
                console.log("Error: ", error);
                res.status(500).send(error);
            }
        });
    }
}