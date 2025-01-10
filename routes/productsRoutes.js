const { productsData } = require('../data/db_client');

module.exports = {
    register_routes: (app) => {
        app.post('/create/product', async (req, res) => {
            try {
                const product = req.body;
                const result = await productsData.createProduct(product);
                if(result) {
                    res.status(201).send({
                        success: true,
                    });
                } else {
                    res.status(200).send({
                        success: false,
                    });
                }
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/accept/product', async (req, res) => {
            try {
                const { id } = req.body;
                const result = await productsData.acceptProduct(id);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/reject/product', async (req, res) => {
            try {
                const { id, comments } = req.body;
                const result = await productsData.rejectProduct(id, comments);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/get/products', async (req, res) => {
            try {
                const { category } = req.body;
                const result = await productsData.getAllProducts(category);
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
                if(result) {
                    res.status(201).send({
                        success: true,
                    });
                } else {
                    res.status(200).send({
                        success: false,
                    });
                }
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/get/product', async (req, res) => {
            try {
                const { id } = req.body;
                const result = await productsData.getProduct(id);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.delete('/delete/product', async (req, res) => {
            try {
                const { id } = req.body;
                const result = await productsData.deleteProduct(id);
                if(result) {
                    res.status(201).send({
                        success: true,
                    });
                } else {
                    res.status(200).send({
                        success: false,
                    });
                }
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/get/products/for/seller', async (req, res) => {
            try {
                const { mobile } = req.body;
                const result = await productsData.getProductsForSeller(mobile);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });
    }
}