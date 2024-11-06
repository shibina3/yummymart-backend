const { categoriesData } = require('../data/db_client');
module.exports = {
    register_routes: (app) => {
        app.post('/create/category', async (req, res) => { 
            try {
                const category = req.body;
                const result = await categoriesData.createCategory(category);
                res.status(201).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/get/categories', async (req, res) => {
            try {
                const result = await categoriesData.getCategories();
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.put('/update/category', async (req, res) => {
            try {
                const category = req.body;
                const result = await categoriesData.updateCategory(category);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.delete('/delete/category', async (req, res) => {
            try {
                const { id } = req.body;
                const result = await categoriesData.deleteCategory(id);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });
    }
}