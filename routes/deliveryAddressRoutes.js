const { deliveryAddressData } = require('../data/db_client');

module.exports = {
    register_routes: (app) => {
        app.post('/add/deliveryAddress', async (req, res) => {
            try {
                const deliveryAddress = req.body;
                const result = await deliveryAddressData.createDeliveryAddress(deliveryAddress);
                res.status(201).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/get/deliveryAddress', async (req, res) => {
            try {
                const { user_id } = req.body;
                const result = await deliveryAddressData.getDeliveryAddresses(user_id);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/update/deliveryAddress', async (req, res) => {
            try {
                const deliveryAddress = req.body;
                const result = await deliveryAddressData.updateDeliveryAddress(deliveryAddress);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/remove/deliveryAddress', async (req, res) => {
            try {
                const { id } = req.body;
                const result = await deliveryAddressData.deleteDeliveryAddress(id);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });
    }
}