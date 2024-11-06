const { orderItemsData } = require('../data/db_client');

module.exports = {
    register_routes: (app) => {
        app.post('/add/orderItem', async (req, res) => {
            try {
                const orderItems = req.body;
                const result = await orderItemsData.createOrderItem(orderItems);
                res.status(201).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/get/orderItem', async (req, res) => {
            try {
                const { order_id } = req.body;
                const result = await orderItemsData.getOrderItems(order_id);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/update/orderItem', async (req, res) => {
            try {
                const orderItems = req.body;
                const result = await orderItemsData.updateOrderItem(orderItems);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/remove/orderItem', async (req, res) => {
            try {
                const { order_id } = req.body;
                const result = await orderItemsData.deleteOrderItem(order_id);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });
    }
}