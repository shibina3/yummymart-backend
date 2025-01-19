const { cartData } = require('../data/db_client');

module.exports = {
    register_routes: (app) => {
        app.post('/add/cart', async (req, res) => {
            try {
                const { mobile, product_id, quantity } = req.body;
                const result = await cartData.addToCart(mobile, product_id, quantity);
                res.status(201).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/get/cart', async (req, res) => {
            try {
                const { mobile } = req.body;
                const result = await cartData.getCart(mobile);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/update/cart', async (req, res) => {
            try {
                const { mobile, product_id, quantity } = req.body;
                const result = await cartData.updateCart(mobile, product_id, quantity);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/remove/cart', async (req, res) => {
            try {
                const { mobile, product_id } = req.body;
                const result = await cartData.removeFromCart(mobile, product_id);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });
    }
}