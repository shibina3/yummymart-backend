const { orderData } = require('../data/db_client');

module.exports = {
    register_routes: (app) => {
        app.post('/add/order', async (req, res) => {
            try {
                const orders = req.body;
                const result = await orderData.createOrder(orders);
                res.status(201).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/get/order', async (req, res) => {
            try {
                const { user_id } = req.body;
                const result = await orderData.updateOrder(user_id);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/update/order', async (req, res) => {
            try {
                const orders = req.body;
                const result = await orderData.updateOrder(orders);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/remove/order', async (req, res) => {
            try {
                const { order_id } = req.body;
                const result = await orderData.deleteOrder(order_id);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });
    }
}