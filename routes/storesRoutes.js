const { storesData } = require('../data/db_client');

module.exports = {
    register_routes: (app) => {
        app.post('/create/store', async (req, res) => {
            try {
                const store = req.body;
                const result = await storesData.createStore(store);
                res.status(201).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/get/stores', async (req, res) => {
            try {
                const result = await storesData.getStores();
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.put('/update/store', async (req, res) => {
            try {
                const store = req.body;
                const result = await storesData.updateStore(store);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.delete('/delete/store', async (req, res) => {
            try {
                const { id } = req.body;
                const result = await storesData.deleteStore(id);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });
    }
}