const { wishlistData } = require('../data/db_client');

module.exports = {
    register_routes: (app) => {
        app.post('/create/wishlist', async (req, res) => {
            try {
                const { user_id, product_id } = req.body;
                const result = await wishlistData.addToWishlist(user_id, product_id);
                res.status(201).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/get/wishlists', async (req, res) => {
            try {
                const { user_id } = req.body;
                const result = await wishlistData.getWishlist(user_id);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.delete('/delete/wishlist', async (req, res) => {
            try {
                const { user_id, product_id } = req.body;
                const result = await wishlistData.removeFromWishlist(user_id, product_id);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });
    }
}