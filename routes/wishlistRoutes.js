const { wishlistData } = require('../data/db_client');

module.exports = {
    register_routes: (app) => {
        app.post('/create/wishlist', async (req, res) => {
            try {
                const { mobile, product_id } = req.body;
                const result = await wishlistData.addToWishlist(mobile, product_id);
                res.status(201).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.post('/get/wishlists', async (req, res) => {
            try {
                const { mobile } = req.body;
                const result = await wishlistData.getWishlist(mobile);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });

        app.delete('/delete/wishlist', async (req, res) => {
            try {
                const { mobile, product_id } = req.body;
                const result = await wishlistData.removeFromWishlist(mobile, product_id);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send(error);
            }
        });
    }
}