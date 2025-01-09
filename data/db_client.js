import pg from 'pg';
import axios from 'axios';
import AWS from 'aws-sdk';

AWS.config.update({ region: 'your-region' });
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const pool = new pg.Pool({
    user: 'postgres',
    host: 'database-1.c5c84ymo4r9u.us-east-1.rds.amazonaws.com',
    database: 'postgres',
    password: 'yummiemart2024',
    port: 5432,
    ssl: {
        rejectUnauthorized: false
    }
});

let client;
(async () => {
    client = await pool.connect();
    console.log('Connected to the database');
})();

const MSG91_API_KEY = 'your-msg91-api-key';
const SENDER_ID = 'YOUR_SENDER_ID';
const OTP_LENGTH = 6;

const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString(); 
};

const sendOtp = async (mobileNumber, otp) => {
    try {
        const response = await axios.get('https://api.msg91.com/api/v5/otp', {
            params: {
                authkey: MSG91_API_KEY,
                mobile: `91${mobileNumber}`,
                otp: otp,
                sender: SENDER_ID,
                otp_length: OTP_LENGTH,
                message: `Your verification code is ${otp}. Please do not share this code with anyone.`,
            }
        });
        return response.data;
    } catch (error) {
        console.error("Error sending OTP:", error.response ? error.response.data : error.message);
        throw new Error("Failed to send OTP");
    }
};

const storeOtp = async (mobileNumber, otp) => {
    const params = {
        TableName: 'otp',
        Item: {
            mobileNumber: mobileNumber,
            otp: otp,
            ttl: Math.floor(Date.now() / 1000) + 300
        }
    };
    const result = await dynamoDB.put(params).promise();
    return result;
}

const getOtp = async (mobileNumber) => {
    const params = {
        TableName: 'otp',
        Key: {
            mobileNumber: mobileNumber
        }
    };
    const result = await dynamoDB.get(params).promise();
    return result.Item;
}

const userData = {
    registerUser: async (user) => {
        const { name, email, mobile, receiveWhatsapp, receiveSMS, receiveEmail } = user;
        const query = {
            text: 'INSERT INTO users(name, email, phone_number, receivesms, receivewhatsapp, receiveemail, user_type) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            values: [name, email, mobile, receiveSMS, receiveWhatsapp, receiveEmail, 'buyer']
        };
        const result = await client.query(query.text, query.values);
        return result.rows[0];
    },
    getUserByEmailOrMob: async (emailOrMob) => {
        try {
            const query = {
                text: 'SELECT * FROM users WHERE email = $1 OR phone_number = $1',
                values: [emailOrMob]
            };

            const result = await client.query(query.text, query.values);
            if(result.rows[0].seller) {
                const storeQuery = {
                    text: 'SELECT * FROM stores WHERE phone_number = $1',
                    values: [emailOrMob]
                };
                const storeResult = await client.query(storeQuery.text, storeQuery.values);
                result.rows[0].store = storeResult.rows[0];
            }
            return result.rows[0];
        } catch (error) {
            console.error("Error in getUserByEmailOrMob: ", error);
        }
    },
    sendOTP: async (mobile) => {
        const otp = generateOtp();
        await sendOtp(mobile, otp);
        await storeOtp(mobile, otp);
    },
    verifyOTP: async (mobile, otp) => {
        // let sentOtp = await getOtp(mobile);
        let sentOtp = {
            otp: '1234'
        };
        if (!sentOtp) {
            return {
                error: "OTP not found. Please try again",
                isVerified: false
            };
        }
        if (sentOtp.otp !== otp) {
            return {
                error: "Invalid OTP. Please try again",
                isVerified: false
            }
        }
        let getUser = await userData.getUserByEmailOrMob(mobile);
        if (!getUser) {
            return {
                message: "OTP verified successfully",
                isVerified: true,
                isNewUser: true,
            }
        } else {
            let userType = getUser.user_type;
            return {
                message: "OTP verified successfully",
                isVerified: true,
                isNewUser: false,
                userType: userType
            }
        }
        
    },
    deRegisterUser: async (email) => {
        const query = {
            text: 'DELETE FROM users WHERE email = $1',
            values: [email]
        };
        const result = await client.query(query);
        return result.rows[0];
    },
    registerSeller: async (seller) => {
        const { mobile, name, address, rating, reviews, gstnumber, gstnumber_url, pancard, pancard_url, fssai_license_number, fssai_cert_url, msme_license_number, msme_cert_url, dealer_cert_url, distributor_cert_url, resubmit } = seller;
        const updatedUserQuery = {
            text: 'UPDATE users SET user_type = $2, seller_submission_status = $3 WHERE phone_number = $1 RETURNING *',
            values: [mobile, 'seller', 'pending']
        }
        await client.query(updatedUserQuery);
        const storeDetails = {
            mobile, name, address, rating, reviews, gstnumber, gstnumber_url, pancard, pancard_url, fssai_license_number, fssai_cert_url, msme_license_number, msme_cert_url, dealer_cert_url, distributor_cert_url
        }
        if(resubmit) {
            await storesData.updateStore(storeDetails);
            await storesData.resetStatus(mobile);
        } else {
            await storesData.createStore(storeDetails);
        }
        return {success: true};
    },
    getUserType: async (mobile) => {
        const query = {
            text: 'SELECT user_type, seller_submission_status FROM users WHERE phone_number = $1',
            values: [mobile]
        };
        const result = await client.query(query.text, query.values);

        if(result.rows[0].seller_submission_status === 'rejected') {
            let getCommentQuery = {
                text: 'SELECT comments FROM stores WHERE phone_number = $1',
                values: [mobile]
            }
            let comments = await client.query(getCommentQuery.text, getCommentQuery.values);
            result.rows[0].comments = comments.rows[0].comments;
        }
        return result.rows[0];
    },
    getSubmittedSellers: async () => {
        const query = {
            text: 'SELECT * FROM users WHERE seller_submission_status = $1',
            values: ['pending']
        };
        const result = await client.query(query.text, query.values);
        for(let i = 0; i < result.rows.length; i++) {
            const storeResult = await storesData.getStore(result.rows[i].phone_number);
            result.rows[i].store = storeResult
        }
        return result.rows;
    },
    getSellerSubmittedDetails: async (mobile) => {
        const query = {
            text: 'SELECT * FROM stores WHERE phone_number = $1',
            values: [mobile]
        };
        const result = await client.query(query.text, query.values);
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
        await client.query(query);

        const selectQuery = {
            text: 'SELECT * FROM categories'
        };
        const result = await client.query(selectQuery);
        return result.rows;
    },
    getCategories: async () => {
        const query = {
            text: 'SELECT * FROM categories'
        };
        const result = await client.query(query);
        return result.rows;
    },
    updateCategory: async (category) => {
        const { id, name, description, image_url } = category;
        const query = {
            text: 'UPDATE categories SET name = $1, description = $2, image_url = $3 WHERE id = $4 RETURNING *',
            values: [name, description, image_url, id]
        };
        await client.query(query);

        const selectQuery = {
            text: 'SELECT * FROM categories'
        };
        const result = await client.query(selectQuery);
        return result.rows;
    },
    deleteCategory: async (id) => {
        const query = {
            text: 'DELETE FROM categories WHERE id = $1',
            values: [id]
        };
        await client.query(query);

        const selectQuery = {
            text: 'SELECT * FROM categories'
        };
        const result = await client.query(selectQuery);
        return result.rows;
    }
} 

const productsData = {
    createProduct: async (product) => {
        const { name, description, category_id, products_images, allow_get_quote, stock, store_id, mrp, yummy_price, max_quantity, min_quantity, min_b2b_quantity, thumbnail_image } = product;
        const query = {
            text: 'INSERT INTO products(name, description, category_id, products_images, allow_get_quote, stock, store_id, mrp, yummy_price, max_quantity, min_quantity, min_b2b_quantity, thumbnail_image, verification_status) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *',
            values: [name, description, category_id, JSON.stringify(products_images), allow_get_quote, stock, store_id, mrp, yummy_price, max_quantity, min_quantity, min_b2b_quantity, thumbnail_image, 'pending']
        };
        await client.query(query);

        return true;
    },
    acceptProduct: async (id) => {
        const query = {
            text: 'UPDATE products SET is_admin_verified = $2, verification_status = $3 WHERE id = $1 RETURNING *',
            values: [id, true, 'verified']
        };
        await client.query(query);

        const allProductsQuery = {
            text: 'SELECT * FROM products'
        };
        const result = await client.query(allProductsQuery);

        return result.rows;
    },
    rejectProduct: async (id, comments) => {
        const query = {
            text: 'UPDATE products SET is_admin_verified = $2, admin_comments = $3, verification_status = $4 WHERE id = $1 RETURNING *',
            values: [id, false, comments, 'rejected']
        };
        await client.query(query);

        const allProductsQuery = {
            text: 'SELECT * FROM products'
        };
        const result = await client.query(allProductsQuery);
        return result.rows;
    },
    getAllProducts: async (category) => {
        let query;
        if(category === 'all' || !category) {
            query = {
                text: 'SELECT * FROM products'
            };
        } else {
            const getCategoryIdQuery = {
                text: 'SELECT id FROM categories WHERE name = $1',
                values: [category]
            }
            const categoryId = await client.query(getCategoryIdQuery);
            console.log("Category ID: ", categoryId[0]);
            
            query = {
                text: 'SELECT * FROM products WHERE category_id = $1',
                values: [categoryId]
            };
        }
        const result = await client.query(query);
        return result.rows;
    },
    getProduct: async (id) => {
        const query = {
            text: 'SELECT * FROM products WHERE id = $1',
            values: [id]
        };
        const result = await client.query(query);
        return result.rows[0];
    },
    getVerifiedProducts: async (category) => {
        if(category === 'all') {
            const query = {
                text: 'SELECT * FROM products WHERE is_admin_verified = $1',
                values: [true]
            };
            const result = await client.query(query);
            return result.rows;
        } else {
            const getCategoryIdQuery = {
                text: 'SELECT id FROM categories WHERE name = $1',
                values: [category]
            }
            const categoryId = await client.query(getCategoryIdQuery);
            const query = {
                text: 'SELECT * FROM products WHERE category_id = $1 AND is_admin_verified = $2',
                values: [categoryId, true]
            };
            const result = await client.query(query);
            return result.rows;
        }
    },
    updateProduct: async (product) => {
        const { id, name, description, products_images, allow_get_quote, stock, store_id, mrp, yummy_price, category_id, max_quantity, min_quantity, min_b2b_quantity, thumbnail_image } = product;
        const query = {
            text: 'UPDATE products SET name = $1, description = $2, products_images = $3, allow_get_quote = $4, stock = $5, store_id = $6, mrp = $7, yummy_price = $8, category_id = $9, max_quantity = $10, min_quantity = $11, min_b2b_quantity = $12, thumbnail_image = $13, verification_status = $15 WHERE id = $14 RETURNING *',
            values: [name, description, JSON.stringify(products_images), allow_get_quote, stock, store_id, mrp, yummy_price, category_id, max_quantity, min_quantity, min_b2b_quantity, thumbnail_image, id, 'pending']
        };
        await client.query(query);

        return true;
    },
    deleteProduct: async (id) => {
        const query = {
            text: 'DELETE FROM products WHERE id = $1',
            values: [id]
        };
        await client.query(query);
        return true;
    }
}

const storesData = {
    createStore: async (store) => {
        try {
            const { mobile, name, address, reviews, rating, pancard, pancard_url, gstnumber, gstnumber_url, fssai_license_number, fssai_cert_url, msme_license_number, msme_cert_url, dealer_cert_url, distributor_cert_url } = store;
            const query = {
                text: 'INSERT INTO stores(phone_number, name, address, reviews, rating, pancard, pancard_url, gstnumber, gstnumber_url, fssai_license_number, fssai_cert_url, msme_license_number, msme_cert_url, dealer_cert_url, distributor_cert_url) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *',
                values: [mobile, name, address, reviews, rating, pancard, pancard_url, gstnumber, gstnumber_url, fssai_license_number, fssai_cert_url, msme_license_number, msme_cert_url, dealer_cert_url, distributor_cert_url]
            };
            await client.query(query);
            return true;
        } catch (error) {
            console.error("Error creating store: ", error);
            return false;
        }
    },
    getStore: async (mobile) => {
        const query = {
            text: 'SELECT * FROM stores WHERE phone_number = $1',
            values: [mobile]
        };
        const result = await client.query(query.text, query.values);
        return result.rows[0];
    },
    getStores: async () => {
        const query = {
            text: 'SELECT * FROM stores'
        };
        const result = await client.query(query);
        return result.rows;
    },
    updateStore: async (store) => {
        const { mobile, name, address, reviews, rating, pancard, pancard_url, gstnumber, gstnumber_url, fssai_license_number, fssai_cert_url, msme_license_number, msme_cert_url, dealer_cert_url, distributor_cert_url } = store;
        const query = {
            text: 'UPDATE stores SET name = $2, address = $3, reviews = $4, rating = $5, pancard = $6, pancard_url = $7, gstnumber = $8, gstnumber_url = $9, fssai_license_number = $10, fssai_cert_url = $11, msme_license_number = $12, msme_cert_url = $13, dealer_cert_url = $14, distributor_cert_url = $15 WHERE phone_number = $1 RETURNING *',
            values: [mobile, name, address, reviews, rating, pancard, pancard_url, gstnumber, gstnumber_url, fssai_license_number, fssai_cert_url, msme_license_number, msme_cert_url, dealer_cert_url, distributor_cert_url]
        };
        await client.query(query);
        return true;
    },
    resetStatus: async (mobile) => {
        const query = {
            text: 'UPDATE users SET seller_submission_status = $2 WHERE phone_number = $1 RETURNING *',
            values: [mobile, 'pending']
        };
        await client.query(query);
        return true;
    },
    deleteStore: async (id) => {
        const query = {
            text: 'DELETE FROM stores WHERE id = $1',
            values: [id]
        };
        await client.query(query);

        const selectQuery = {
            text: 'SELECT * FROM stores'
        };
        const result = await client.query(selectQuery);
        return result.rows;
    },
    acceptSeller: async (mobile) => {
        const query = {
            text: 'UPDATE users SET seller_submission_status = $2 WHERE phone_number = $1 RETURNING *',
            values: [mobile, 'verified']
        };
        await client.query(query);
        return true;
    },
    rejectSeller: async (mobile, comments) => {
        const query = {
            text: 'UPDATE users SET seller_submission_status = $2 WHERE phone_number = $1 RETURNING *',
            values: [mobile, 'rejected']
        };
        await client.query(query);

        const storeQuery = {
            text: 'UPDATE stores SET comments = $2 WHERE phone_number = $1 RETURNING *',
            values: [mobile, comments]
        };
        await client.query(storeQuery);
        return true;
    }
}

const wishlistData = {
    addToWishlist: async (user_id, product_id) => {
        const query = {
            text: 'INSERT INTO wishlist(user_id, product_id) VALUES($1, $2) RETURNING *',
            values: [user_id, product_id]
        };
        await client.query(query);

        const selectQuery = {
            text: 'SELECT * FROM wishlist WHERE user_id = $1',
            values: [user_id]
        };
        const result = await client.query(selectQuery);
        return result.rows;
    },
    getWishlist: async (user_id) => {
        const query = {
            text: 'SELECT * FROM wishlist WHERE user_id = $1',
            values: [user_id]
        };
        const result = await client.query(query);
        return result.rows;
    },
    removeFromWishlist: async (user_id, product_id) => {
        const query = {
            text: 'DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2',
            values: [user_id, product_id]
        };
        await client.query(query);

        const selectQuery = {
            text: 'SELECT * FROM wishlist WHERE user_id = $1',
            values: [user_id]
        };
        const result = await client.query(selectQuery);
        return result.rows;
    }
}

const cartData = {
    addToCart: async (user_id, product_id, quantity) => {
        const insertQuery = {
            text: 'INSERT INTO cart(user_id, product_id, quantity) VALUES($1, $2, $3) RETURNING *',
            values: [user_id, product_id, quantity]
        };
        await client.query(insertQuery);
        
        const selectQuery = {
            text: 'SELECT * FROM cart WHERE user_id = $1',
            values: [user_id]
        };
        const result = await client.query(selectQuery);
        return result.rows;
    },
    getCart: async (user_id) => {
        const query = {
            text: 'SELECT * FROM cart WHERE user_id = $1',
            values: [user_id]
        };
        const result = await client.query(query);
        return result.rows;
    },
    removeFromCart: async (user_id, product_id) => {
        const removeQuery = {
            text: 'DELETE FROM cart WHERE user_id = $1 AND product_id = $2',
            values: [user_id, product_id]
        };
        await client.query(removeQuery);

        const selectQuery = {
            text: 'SELECT * FROM cart WHERE user_id = $1',
            values: [user_id]
        };
        const result = await client.query(selectQuery);
        return result.rows;
    },
    updateCart: async (user_id, product_id, quantity) => {
        const query = {
            text: 'UPDATE cart SET quantity = $3 WHERE user_id = $1 AND product_id = $2 RETURNING *',
            values: [user_id, product_id, quantity]
        };
        await client.query(query);

        const selectQuery = {
            text: 'SELECT * FROM cart WHERE user_id = $1',
            values: [user_id]
        };
        const result = await client.query(selectQuery);
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
        await client.query(query);

        const selectQuery = {
            text: 'SELECT * FROM orders WHERE user_id = $1',
            values: [user_id]
        };
        const result = await client.query(selectQuery);
        return result.rows;
    },
    getOrders: async (user_id) => {
        const query = {
            text: 'SELECT * FROM orders WHERE user_id = $1',
            values: [user_id]
        };
        const result = await client.query(query);
        return result.rows;
    },
    updateOrder: async (order) => {
        const { order_id, user_id, store_id, delivery_address_id, payment_method, total, order_status, payment_status, transaction_id, created_at, expected_delivery } = order;
        const query = {
            text: 'UPDATE orders SET user_id = $2, store_id = $3, delivery_address_id = $4, payment_method = $5, total = $6, order_status = $7, payment_status = $8, transaction_id = $9, created_at = $10, expected_delivery = $11 WHERE id = $1 RETURNING *',
            values: [order_id, user_id, store_id, delivery_address_id, payment_method, total, order_status, payment_status, transaction_id, created_at, expected_delivery]
        };
        await client.query(query);

        const selectQuery = {
            text: 'SELECT * FROM orders WHERE user_id = $1',
            values: [user_id]
        };
        const result = await client.query(selectQuery);
        return result.rows;
    },
    deleteOrder: async (id) => {
        const query = {
            text: 'DELETE FROM orders WHERE id = $1',
            values: [id]
        };
        await client.query(query);

        const selectQuery = {
            text: 'SELECT * FROM orders'
        };
        const result = await client.query(selectQuery);
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
        await client.query(query);

        const selectQuery = {
            text: 'SELECT * FROM order_items WHERE order_id = $1',
            values: [order_id]
        };
        const result = await client.query(selectQuery);
        return result.rows;
    },
    getOrderItems: async (order_id) => {
        const query = {
            text: 'SELECT * FROM order_items WHERE order_id = $1',
            values: [order_id]
        };
        const result = await client.query(query);
        return result.rows;
    },
    updateOrderItem: async (order_item) => {
        const { order_id, product_id, quantity, price } = order_item;
        const query = {
            text: 'UPDATE order_items SET quantity = $3, price = $4 WHERE order_id = $1 AND product_id = $2 RETURNING *',
            values: [order_id, product_id, quantity, price]
        };
        await client.query(query);

        const selectQuery = {
            text: 'SELECT * FROM order_items WHERE order_id = $1',
            values: [order_id]
        };
        const result = await client.query(selectQuery);
        return result.rows;
    },
    deleteOrderItem: async (order_id, product_id) => {
        const query = {
            text: 'DELETE FROM order_items WHERE order_id = $1 AND product_id = $2',
            values: [order_id, product_id]
        };
        await client.query(query);

        const selectQuery = {
            text: 'SELECT * FROM order_items WHERE order_id = $1',
            values: [order_id]
        };
        const result = await client.query(selectQuery);
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
        await client.query(query);

        const selectQuery = {
            text: 'SELECT * FROM delivery_addresses WHERE user_id = $1',
            values: [user_id]
        };
        const result = await client.query(selectQuery);
        return result.rows;
    },
    getDeliveryAddresses: async (user_id) => {
        const query = {
            text: 'SELECT * FROM delivery_addresses WHERE user_id = $1',
            values: [user_id]
        };
        const result = await client.query(query);
        return result.rows;
    },
    updateDeliveryAddress: async (delivery_address) => {
        const { id, user_id, type, address_line_1, address_line_2, city, state, pincode, phone_number } = delivery_address;
        const query = {
            text: 'UPDATE delivery_addresses SET user_id = $2, type = $3, address_line_1 = $4, address_line_2 = $5, city = $6, state = $7, pincode = $8, phone_number = $9 WHERE id = $1 RETURNING *',
            values: [id, user_id, type, address_line_1, address_line_2, city, state, pincode, phone_number]
        };
        await client.query(query);

        const selectQuery = {
            text: 'SELECT * FROM delivery_addresses WHERE user_id = $1',
            values: [user_id]
        };
        const result = await client.query(selectQuery);
        return result.rows;
    },
    deleteDeliveryAddress: async (id) => {
        const query = {
            text: 'DELETE FROM delivery_addresses WHERE id = $1',
            values: [id]
        };
        await client.query(query);

        const selectQuery = {
            text: 'SELECT * FROM delivery_addresses'
        };
        const result = await client.query(selectQuery);
        return result.rows;
    }
}

export {
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