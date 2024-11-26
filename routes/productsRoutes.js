const { productsData } = require('../data/db_client');

module.exports = {
    register_routes: (app) => {
        app.post('/create/product', async (req, res) => {
            try {
                const product = req.body;
                const result = await productsData.createProduct(product);
                res.status(201).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/get/products', async (req, res) => {
            try {
                const { category } = req.body;
                const result = await productsData.getProducts(category);
                res.status(200).send(result);
            } catch (error) {
                console.log("Error: ", error);
                res.status(500).send(error);
            }
        });

        app.put('/update/product', async (req, res) => {
            try {
                const product = req.body;
                const result = await productsData.updateProduct(product);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.delete('/delete/product', async (req, res) => {
            try {
                const { id } = req.body;
                const result = await productsData.deleteProduct(id);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });
    }
}