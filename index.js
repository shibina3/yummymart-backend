const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const isLocalEnv = process.env.NODE_ENV === 'development';

const userRoutes = require('./routes/userRoutes');
const categoriesRoutes = require('./routes/categoriesRoutes');
const productsRoutes = require('./routes/productsRoutes');
const cartRoutes = require('./routes/cartRoutes');
const wishListRoutes = require('./routes/wishListRoutes');
const orderItemsRoutes = require('./routes/orderItemsRoutes');
const ordersRoutes = require('./routes/ordersRoutes');
const deliveryAddressRoutes = require('./routes/deliveryAddressRoutes');
const storeRoutes = require('./routes/storesRoutes');

userRoutes.register_routes(app);
categoriesRoutes.register_routes(app);
productsRoutes.register_routes(app);
cartRoutes.register_routes(app);
wishListRoutes.register_routes(app);
orderItemsRoutes.register_routes(app);
ordersRoutes.register_routes(app);
deliveryAddressRoutes.register_routes(app);
storeRoutes.register_routes(app);

if(isLocalEnv) {
    const PORT = 4000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
} else {
    exports.handler = serverless(app);
}