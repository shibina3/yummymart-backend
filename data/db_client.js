const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'database-1.c5c84ymo4r9u.us-east-1.rds.amazonaws.com',
    database: 'order2me',
    password: 'yummiemart2024',
    port: 5432,
    ssl: {
        rejectUnauthorized: false
    }
});

const userData = {
    registerUser: async (user) => {
        const { name, email, password, phone_number, location, buyer, seller, delivery_partner, admin } = user;
        const query = {
            text: 'INSERT INTO users(name, email, password, phone_number, location, buyer, seller, delivery_partner, admin) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            values: [name, email, password, phone_number, location, buyer, seller, delivery_partner, admin]
        };
        const result = await pool.query(query);
        return result.rows[0];
    },
    getUserByEmail: async (email) => {
        const query = {
            text: 'SELECT * FROM users WHERE email = $1',
            values: [email]
        };
        const result = await pool.query(query);
        return result.rows[0];
    },
    deRegisterUser: async (email) => {
        const query = {
            text: 'DELETE FROM users WHERE email = $1',
            values: [email]
        };
        const result = await pool.query(query);
        return result.rows[0];
    }
}

const categoriesData = {
    createCategory: async (category) => {
        const { name, description, image_url } = category;
        const query = {
            text: 'INSERT INTO categories(name, description, image_url) VALUES($1, $2, $3) RETURNING *',
            values: [name, description, image_url]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM categories'
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    },
    getCategories: async () => {
        const query = {
            text: 'SELECT * FROM categories'
        };
        const result = await pool.query(query);
        return result.rows;
    },
    updateCategory: async (category) => {
        const { id, name, description, image_url } = category;
        const query = {
            text: 'UPDATE categories SET name = $1, description = $2, image_url = $3 WHERE id = $4 RETURNING *',
            values: [name, description, image_url, id]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM categories'
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    },
    deleteCategory: async (id) => {
        const query = {
            text: 'DELETE FROM categories WHERE id = $1',
            values: [id]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM categories'
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    }
} 

const productsData = {
    createProduct: async (product) => {
        const { name, description, category_id, image_url, stock, store_id, mrp, yummy_price } = product;
        const query = {
            text: 'INSERT INTO products(name, description, image_url, stock, store_id, mrp, yummy_price, category_id) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            values: [name, description, image_url, price, category_id]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM products'
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    },
    getProducts: async () => {
        const query = {
            text: 'SELECT * FROM products'
        };
        const result = await pool.query(query);
        return result.rows;
    },
    updateProduct: async (product) => {
        const { id, name, description, image_url, category_id, stock, store_id, mrp, yummy_price } = product;
        const query = {
            text: 'UPDATE products SET name = $1, description = $2, image_url = $3, mrp = $4, yummy_price = $5, category_id = $6, stock = $7, store_id = $8 WHERE id = $9 RETURNING *',
            values: [name, description, image_url, mrp, yummy_price, category_id, stock, store_id, id]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM products'
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    },
    deleteProduct: async (id) => {
        const query = {
            text: 'DELETE FROM products WHERE id = $1',
            values: [id]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM products'
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    }
}

const storesData = {
    createStore: async (store) => {
        const { name, address, image_url, rating, reviews, pancard } = store;
        const query = {
            text: 'INSERT INTO stores(name, address, image_url, rating, reviews, pancard) VALUES($1, $2, $3, $4, $5, $6) RETURNING *',
            values: [name, address, image_url, rating, reviews, pancard]
        };
        await pool.query(query);
        const selectQuery = {
            text: 'SELECT * FROM stores'
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    },
    getStores: async () => {
        const query = {
            text: 'SELECT * FROM stores'
        };
        const result = await pool.query(query);
        return result.rows;
    },
    updateStore: async (store) => {
        const { id, name, address, image_url, rating, reviews, pancard } = store;
        const query = {
            text: 'UPDATE stores SET name = $1, address = $2, image_url = $3, rating = $4, reviews = $5, pancard = $6 WHERE id = $7 RETURNING *',
            values: [name, address, image_url, rating, reviews, pancard, id]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM stores'
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    },
    deleteStore: async (id) => {
        const query = {
            text: 'DELETE FROM stores WHERE id = $1',
            values: [id]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM stores'
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    }
}

const wishlistData = {
    addToWishlist: async (user_id, product_id) => {
        const query = {
            text: 'INSERT INTO wishlist(user_id, product_id) VALUES($1, $2) RETURNING *',
            values: [user_id, product_id]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM wishlist WHERE user_id = $1',
            values: [user_id]
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    },
    getWishlist: async (user_id) => {
        const query = {
            text: 'SELECT * FROM wishlist WHERE user_id = $1',
            values: [user_id]
        };
        const result = await pool.query(query);
        return result.rows;
    },
    removeFromWishlist: async (user_id, product_id) => {
        const query = {
            text: 'DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2',
            values: [user_id, product_id]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM wishlist WHERE user_id = $1',
            values: [user_id]
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    }
}

const cartData = {
    addToCart: async (user_id, product_id, quantity) => {
        const insertQuery = {
            text: 'INSERT INTO cart(user_id, product_id, quantity) VALUES($1, $2, $3) RETURNING *',
            values: [user_id, product_id, quantity]
        };
        await pool.query(insertQuery);
        
        const selectQuery = {
            text: 'SELECT * FROM cart WHERE user_id = $1',
            values: [user_id]
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    },
    getCart: async (user_id) => {
        const query = {
            text: 'SELECT * FROM cart WHERE user_id = $1',
            values: [user_id]
        };
        const result = await pool.query(query);
        return result.rows;
    },
    removeFromCart: async (user_id, product_id) => {
        const removeQuery = {
            text: 'DELETE FROM cart WHERE user_id = $1 AND product_id = $2',
            values: [user_id, product_id]
        };
        await pool.query(removeQuery);

        const selectQuery = {
            text: 'SELECT * FROM cart WHERE user_id = $1',
            values: [user_id]
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    },
    updateCart: async (user_id, product_id, quantity) => {
        const query = {
            text: 'UPDATE cart SET quantity = $3 WHERE user_id = $1 AND product_id = $2 RETURNING *',
            values: [user_id, product_id, quantity]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM cart WHERE user_id = $1',
            values: [user_id]
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    }
}

const orderData = {
    createOrder: async (order) => {
        const { user_id, store_id, delivery_address_id, payment_method, total, order_status, payment_status, transaction_id, created_at, expected_delivery } = order;
        const query = {
            text: 'INSERT INTO orders(user_id, store_id, delivery_address_id, payment_method, total, order_status, payment_status, transaction_id, created_at, expected_delivery) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
            values: [user_id, store_id, delivery_address_id, payment_method, total, order_status, payment_status, transaction_id, created_at, expected_delivery]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM orders WHERE user_id = $1',
            values: [user_id]
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    },
    getOrders: async (user_id) => {
        const query = {
            text: 'SELECT * FROM orders WHERE user_id = $1',
            values: [user_id]
        };
        const result = await pool.query(query);
        return result.rows;
    },
    updateOrder: async (order) => {
        const { order_id, user_id, store_id, delivery_address_id, payment_method, total, order_status, payment_status, transaction_id, created_at, expected_delivery } = order;
        const query = {
            text: 'UPDATE orders SET user_id = $2, store_id = $3, delivery_address_id = $4, payment_method = $5, total = $6, order_status = $7, payment_status = $8, transaction_id = $9, created_at = $10, expected_delivery = $11 WHERE id = $1 RETURNING *',
            values: [order_id, user_id, store_id, delivery_address_id, payment_method, total, order_status, payment_status, transaction_id, created_at, expected_delivery]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM orders WHERE user_id = $1',
            values: [user_id]
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    },
    deleteOrder: async (id) => {
        const query = {
            text: 'DELETE FROM orders WHERE id = $1',
            values: [id]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM orders'
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    }
}

const orderItemsData = {
    createOrderItem: async (order_item) => {
        const { order_id, product_id, quantity, price } = order_item;
        const query = {
            text: 'INSERT INTO order_items(order_id, product_id, quantity, price) VALUES($1, $2, $3, $4) RETURNING *',
            values: [order_id, product_id, quantity, price]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM order_items WHERE order_id = $1',
            values: [order_id]
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    },
    getOrderItems: async (order_id) => {
        const query = {
            text: 'SELECT * FROM order_items WHERE order_id = $1',
            values: [order_id]
        };
        const result = await pool.query(query);
        return result.rows;
    },
    updateOrderItem: async (order_item) => {
        const { order_id, product_id, quantity, price } = order_item;
        const query = {
            text: 'UPDATE order_items SET quantity = $3, price = $4 WHERE order_id = $1 AND product_id = $2 RETURNING *',
            values: [order_id, product_id, quantity, price]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM order_items WHERE order_id = $1',
            values: [order_id]
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    },
    deleteOrderItem: async (order_id, product_id) => {
        const query = {
            text: 'DELETE FROM order_items WHERE order_id = $1 AND product_id = $2',
            values: [order_id, product_id]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM order_items WHERE order_id = $1',
            values: [order_id]
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    }
}

const deliveryAddressData = {
    createDeliveryAddress: async (delivery_address) => {
        const { user_id, type, address_line_1, address_line_2, city, state, pincode, phone_number } = delivery_address;
        const query = {
            text: 'INSERT INTO delivery_addresses(user_id, type, address_line_1, address_line_2, city, state, pincode, phone_number) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            values: [user_id, type, address_line_1, address_line_2, city, state, pincode, phone_number]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM delivery_addresses WHERE user_id = $1',
            values: [user_id]
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    },
    getDeliveryAddresses: async (user_id) => {
        const query = {
            text: 'SELECT * FROM delivery_addresses WHERE user_id = $1',
            values: [user_id]
        };
        const result = await pool.query(query);
        return result.rows;
    },
    updateDeliveryAddress: async (delivery_address) => {
        const { id, user_id, type, address_line_1, address_line_2, city, state, pincode, phone_number } = delivery_address;
        const query = {
            text: 'UPDATE delivery_addresses SET user_id = $2, type = $3, address_line_1 = $4, address_line_2 = $5, city = $6, state = $7, pincode = $8, phone_number = $9 WHERE id = $1 RETURNING *',
            values: [id, user_id, type, address_line_1, address_line_2, city, state, pincode, phone_number]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM delivery_addresses WHERE user_id = $1',
            values: [user_id]
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    },
    deleteDeliveryAddress: async (id) => {
        const query = {
            text: 'DELETE FROM delivery_addresses WHERE id = $1',
            values: [id]
        };
        await pool.query(query);

        const selectQuery = {
            text: 'SELECT * FROM delivery_addresses'
        };
        const result = await pool.query(selectQuery);
        return result.rows;
    }
}

module.exports = {
    userData, 
    categoriesData, 
    productsData, 
    storesData, 
    wishlistData, 
    cartData, 
    orderData,
    orderItemsData,
    deliveryAddressData
}