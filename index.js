const pg = require('pg');
const axios = require('axios');
const AWS = require('aws-sdk');

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
        const result = await pool.query(query.text, query.values);
        return result.rows[0];
    },
    getUserByEmailOrMob: async (emailOrMob) => {
        try {
            const query = {
                text: 'SELECT * FROM users WHERE email = $1 OR phone_number = $1',
                values: [emailOrMob]
            };

            const result = await pool.query(query.text, query.values);
            if(result.rows[0].seller) {
                const storeQuery = {
                    text: 'SELECT * FROM stores WHERE phone_number = $1',
                    values: [emailOrMob]
                };
                const storeResult = await pool.query(storeQuery.text, storeQuery.values);
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
        const result = await pool.query(query);
        return result.rows[0];
    },
    registerSeller: async (seller) => {
        const { mobile, name, address, rating, reviews, gstnumber, gstnumber_url, pancard, pancard_url, fssai_license_number, fssai_cert_url, msme_license_number, msme_cert_url, dealer_cert_url, distributor_cert_url, resubmit } = seller;
        const updatedUserQuery = {
            text: 'UPDATE users SET user_type = $2, seller_submission_status = $3 WHERE phone_number = $1 RETURNING *',
            values: [mobile, 'seller', 'pending']
        }
        await pool.query(updatedUserQuery);
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
            text: 'SELECT user_type, seller_submission_status, name FROM users WHERE phone_number = $1',
            values: [mobile]
        };
        const result = await pool.query(query.text, query.values);

        if(result.rows[0].seller_submission_status === 'rejected') {
            let getCommentQuery = {
                text: 'SELECT comments FROM stores WHERE phone_number = $1',
                values: [mobile]
            }
            let comments = await pool.query(getCommentQuery.text, getCommentQuery.values);
            result.rows[0].comments = comments.rows[0].comments;
        }
        return result.rows[0];
    },
    getSubmittedSellers: async () => {
        const query = {
            text: 'SELECT * FROM users WHERE seller_submission_status = $1',
            values: ['pending']
        };
        const result = await pool.query(query.text, query.values);
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
        const result = await pool.query(query.text, query.values);
        return result.rows[0];
    }, 
    getVerifiedSellers: async () => {
        const query = {
            text: 'SELECT * FROM users WHERE seller_submission_status = $1',
            values: ['verified']
        };
        const result = await pool.query(query.text, query.values);
        for(let i = 0; i < result.rows.length; i++) {
            const storeResult = await storesData.getStore(result.rows[i].phone_number);
            result.rows[i].store = storeResult
        }
        return result.rows;
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
    },
    getCategoriesDetails: async () => {
        const query = {
            text: 'SELECT * FROM categories'
        };
        const categories = await pool.query(query);
    
        for (let i = 0; i < categories.rows.length; i++) {
            const productsQuery = {
                text: 'SELECT * FROM products WHERE category_id = $1 and verification_status = $2',
                values: [categories.rows[i].id, 'verified']
            };
            const products = await pool.query(productsQuery.text, productsQuery.values);
            categories.rows[i].products = products.rows;
            categories.rows[i].stores = [];
    
            // Use a Set to track unique store IDs
            const uniqueStoreIds = new Set();
    
            for (let j = 0; j < categories.rows[i].products.length; j++) {
                const storeId = categories.rows[i].products[j].store_id;
    
                // Check if the store ID is already processed
                if (!uniqueStoreIds.has(storeId)) {
                    uniqueStoreIds.add(storeId); // Mark this store ID as processed
    
                    const storeQuery = {
                        text: 'SELECT * FROM stores WHERE id = $1',
                        values: [storeId]
                    };
                    const store = await pool.query(storeQuery.text, storeQuery.values);
                    categories.rows[i].stores.push(store.rows[0]); // Add the store to the array
                }
            }
        }
        return categories.rows;
    }
} 

const productsData = {
    createProduct: async (product) => {
        const { name, description, category_id, products_images, allow_get_quote, stock, store_id, mrp, yummy_price, max_quantity, min_quantity, min_b2b_quantity, thumbnail_image } = product;
        const query = {
            text: 'INSERT INTO products(name, description, category_id, product_images, allow_get_quote, stock, store_id, mrp, yummy_price, max_quantity, min_quantity, min_b2b_quantity, thumbnail_image, verification_status) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *',
            values: [name, description, category_id, JSON.stringify(products_images), allow_get_quote, stock, store_id, mrp, yummy_price, max_quantity, min_quantity, min_b2b_quantity, thumbnail_image, 'pending']
        };
        await pool.query(query);

        return true;
    },
    getProductsForSeller: async (mobile) => {
        const query = {
            text: 'SELECT id FROM stores WHERE phone_number = $1',
            values: [mobile]
        };
        const store = await pool.query(query);

        if(store.rows.length === 0) {
            return [];
        }
        const store_id = store.rows[0].id;

        const productsQuery = {
            text: 'SELECT * FROM products WHERE store_id = $1',
            values: [store_id]
        };
        const result = await pool.query(productsQuery);
        return result.rows;
    },
    acceptProduct: async (id) => {
        const query = {
            text: 'UPDATE products SET is_admin_verified = $2, verification_status = $3 WHERE id = $1 RETURNING *',
            values: [id, true, 'verified']
        };
        await pool.query(query);

        const allProductsQuery = {
            text: 'SELECT * FROM products'
        };
        const result = await pool.query(allProductsQuery);

        return result.rows;
    },
    rejectProduct: async (id, comments) => {
        const query = {
            text: 'UPDATE products SET is_admin_verified = $2, admin_comments = $3, verification_status = $4 WHERE id = $1 RETURNING *',
            values: [id, false, comments, 'rejected']
        };
        await pool.query(query);

        const allProductsQuery = {
            text: 'SELECT * FROM products'
        };
        const result = await pool.query(allProductsQuery);
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
            const categoryId = await pool.query(getCategoryIdQuery);
            if(categoryId.rows.length === 0) {
                return [];
            }            
            query = {
                text: 'SELECT * FROM products WHERE category_id = $1',
                values: [categoryId.rows[0].id]
            };
        }
        const result = await pool.query(query);
        return result.rows;
    },
    getProduct: async (id) => {
        const query = {
            text: 'SELECT * FROM products WHERE id = $1',
            values: [id]
        };
        const result = await pool.query(query);
        let wishlistQuery = {
            text: 'SELECT * FROM wishlist WHERE product_id = $1',
            values: [id]
        }
        let wishlist = await pool.query(wishlistQuery.text, wishlistQuery.values);
        result.rows[0].wishlisted = wishlist.rows.length;

        let reviewsQuery = {
            text: 'SELECT * FROM reviews WHERE product_id = $1',
            values: [id]
        }
        let reviews = await pool.query(reviewsQuery.text, reviewsQuery.values);
        result.rows[0].reviews = reviews.rows;

        let storeQuery = {
            text: 'SELECT * FROM stores WHERE id = $1',
            values: [result.rows[0].store_id]
        }
        let store = await pool.query(storeQuery.text, storeQuery.values);
        result.rows[0].store = store.rows[0];

        const similarProductsQuery = {
            text: 'SELECT * FROM products WHERE category_id = $1 AND id != $2',
            values: [result.rows[0].category_id, id]
        };
        const similarProducts = await pool.query(similarProductsQuery.text, similarProductsQuery.values);
        result.rows[0].similarProducts = similarProducts.rows.slice(0, 6);
        return result.rows[0];
    },
    getVerifiedProducts: async (category) => {
        if(category === 'all') {
            const query = {
                text: 'SELECT * FROM products WHERE is_admin_verified = $1',
                values: [true]
            };
            const result = await pool.query(query);
            for(let i = 0; i < result.rows.length; i++) {
                const categoryQuery = {
                    text: 'SELECT * FROM categories WHERE id = $1',
                    values: [result.rows[i].category_id]
                };
                const category = await pool.query(categoryQuery);
                result.rows[i].category = category.rows[0];
                const storeQuery = {
                    text: 'SELECT * FROM stores WHERE id = $1',
                    values: [result.rows[i].store_id]
                };
                const store = await pool.query(storeQuery);
                result.rows[i].store = store.rows[0];
            }
            return result.rows;
        } else {
            const getCategoryIdQuery = {
                text: 'SELECT * FROM categories WHERE name = $1',
                values: [category]
            }
            const category = await pool.query(getCategoryIdQuery);
            const query = {
                text: 'SELECT * FROM products WHERE category_id = $1 AND is_admin_verified = $2',
                values: [category.rows[0].id, true]
            };
            const result = await pool.query(query);
            for(let i = 0; i < result.rows.length; i++) {
                result.rows[i].category = category.rows[0];
                const storeQuery = {
                    text: 'SELECT * FROM stores WHERE id = $1',
                    values: [result.rows[i].store_id]
                };
                const store = await pool.query(storeQuery);
                result.rows[i].store = store.rows[0];
            }

            return result.rows;
        }

        
    },
    getUnverifiedProducts: async (category) => {
        if(category === 'all') {
            const query = {
                text: 'SELECT * FROM products WHERE is_admin_verified = $1',
                values: [false]
            };
            const result = await pool.query(query);
            for(let i = 0; i < result.rows.length; i++) {
                const categoryQuery = {
                    text: 'SELECT * FROM categories WHERE id = $1',
                    values: [result.rows[i].category_id]
                };
                const category = await pool.query(categoryQuery);
                result.rows[i].category = category.rows[0];
                const storeQuery = {
                    text: 'SELECT * FROM stores WHERE id = $1',
                    values: [result.rows[i].store_id]
                };
                const store = await pool.query(storeQuery);
                result.rows[i].store = store.rows[0];
            }
            return result.rows;
        } else {
            const getCategoryIdQuery = {
                text: 'SELECT * FROM categories WHERE name = $1',
                values: [category]
            }
            const categoryRows = await pool.query(getCategoryIdQuery);
            const query = {
                text: 'SELECT * FROM products WHERE category_id = $1 AND is_admin_verified = $2',
                values: [categoryRows.rows[0].id, false]
            };
            const result = await pool.query(query);
            for(let i = 0; i < result.rows.length; i++) {
                result.rows[i].category = categoryRows.rows[0];
                const storeQuery = {
                    text: 'SELECT * FROM stores WHERE id = $1',
                    values: [result.rows[i].store_id]
                };
                const store = await pool.query(storeQuery);
                result.rows[i].store = store.rows[0];
            }

            return result.rows;
        }
    },
    updateProduct: async (product) => {
        const { id, name, description, products_images, allow_get_quote, stock, store_id, mrp, yummy_price, category_id, max_quantity, min_quantity, min_b2b_quantity, thumbnail_image } = product;
        const query = {
            text: 'UPDATE products SET name = $1, description = $2, product_images = $3, allow_get_quote = $4, stock = $5, store_id = $6, mrp = $7, yummy_price = $8, category_id = $9, max_quantity = $10, min_quantity = $11, min_b2b_quantity = $12, thumbnail_image = $13, verification_status = $15 WHERE id = $14 RETURNING *',
            values: [name, description, JSON.stringify(products_images), allow_get_quote, stock, store_id, mrp, yummy_price, category_id, max_quantity, min_quantity, min_b2b_quantity, thumbnail_image, id, 'pending']
        };
        await pool.query(query);

        return true;
    },
    deleteProduct: async (id) => {
        const query = {
            text: 'DELETE FROM products WHERE id = $1',
            values: [id]
        };
        await pool.query(query);
        return true;
    },
    searchProducts: async (search) => {
        let verifiedProducts = await this.getVerifiedProducts('all');

        let filteredProducts = verifiedProducts.filter(product => {
            return JSON.stringify(product).toLowerCase().includes(search.toLowerCase());
        });

        return filteredProducts;
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
            await pool.query(query);
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
        const result = await pool.query(query.text, query.values);
        return result.rows[0];
    },
    getStores: async () => {
        const query = {
            text: 'SELECT * FROM stores'
        };
        const result = await pool.query(query);
        return result.rows;
    },
    getUnVerifiedStores: async () => {
        const query = {
            text: 'SELECT * FROM stores WHERE verification_status = $1',
            values: ['pending']
        };
        const result = await pool.query(query);
        return result.rows;
    },
    getVerifiedStores: async () => {
        const query = {
            text: 'SELECT * FROM stores WHERE verification_status = $1',
            values: ['verified']
        };
        const result = await pool.query(query);
        return result.rows;
    },
    updateStore: async (store) => {
        const { mobile, name, address, reviews, rating, pancard, pancard_url, gstnumber, gstnumber_url, fssai_license_number, fssai_cert_url, msme_license_number, msme_cert_url, dealer_cert_url, distributor_cert_url } = store;
        const query = {
            text: 'UPDATE stores SET name = $2, address = $3, reviews = $4, rating = $5, pancard = $6, pancard_url = $7, gstnumber = $8, gstnumber_url = $9, fssai_license_number = $10, fssai_cert_url = $11, msme_license_number = $12, msme_cert_url = $13, dealer_cert_url = $14, distributor_cert_url = $15 WHERE phone_number = $1 RETURNING *',
            values: [mobile, name, address, reviews, rating, pancard, pancard_url, gstnumber, gstnumber_url, fssai_license_number, fssai_cert_url, msme_license_number, msme_cert_url, dealer_cert_url, distributor_cert_url]
        };
        await pool.query(query);
        return true;
    },
    resetStatus: async (mobile) => {
        const query = {
            text: 'UPDATE users SET seller_submission_status = $2 WHERE phone_number = $1 RETURNING *',
            values: [mobile, 'pending']
        };
        await pool.query(query);
        return true;
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
    },
    acceptSeller: async (mobile) => {
        const query = {
            text: 'UPDATE users SET seller_submission_status = $2 WHERE phone_number = $1 RETURNING *',
            values: [mobile, 'verified']
        };
        await pool.query(query);
        return true;
    },
    rejectSeller: async (mobile, comments) => {
        const query = {
            text: 'UPDATE users SET seller_submission_status = $2 WHERE phone_number = $1 RETURNING *',
            values: [mobile, 'rejected']
        };
        await pool.query(query);

        const storeQuery = {
            text: 'UPDATE stores SET comments = $2 WHERE phone_number = $1 RETURNING *',
            values: [mobile, comments]
        };
        await pool.query(storeQuery);
        return true;
    }
}

const wishlistData = {
    addToWishlist: async (mobile, product_id) => {
        const userQuery = {
            text: 'SELECT id FROM users WHERE phone_number = $1',
            values: [mobile]
        };
        const user = await pool.query(userQuery.text, userQuery.values);
        if(user.rows.length === 0) {
            return [];
        }
        const user_id = user.rows[0].id;
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
    getWishlist: async (mobile) => {
        const userQuery = {
            text: 'SELECT id FROM users WHERE phone_number = $1',
            values: [mobile]
        };
        const user = await pool.query(userQuery.text, userQuery.values);
        if(user.rows.length === 0) {
            return [];
        }
        const user_id = user.rows[0].id;
        const query = {
            text: 'SELECT * FROM wishlist WHERE user_id = $1',
            values: [user_id]
        };
        const result = await pool.query(query);
        return result.rows;
    },
    removeFromWishlist: async (mobile, product_id) => {
        const userQuery = {
            text: 'SELECT id FROM users WHERE phone_number = $1',
            values: [mobile]
        };
        const user = await pool.query(userQuery.text, userQuery.values);
        if(user.rows.length === 0) {
            return [];
        }
        const user_id = user.rows[0].id;
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
    addToCart: async (mobile, product_id, quantity) => {
        const userQuery = {
            text: 'SELECT id FROM users WHERE phone_number = $1',
            values: [mobile]
        };
        const user = await pool.query(userQuery.text, userQuery.values);
        if(user.rows.length === 0) {
            return [];
        }
        const user_id = user.rows[0].id;
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
    getCart: async (mobile) => {

        const userQuery = {
            text: 'SELECT id FROM users WHERE phone_number = $1',
            values: [mobile]
        };
        const user = await pool.query(userQuery.text, userQuery.values);
        if(user.rows.length === 0) {
            return [];
        }
        const user_id = user.rows[0].id;
        const query = {
            text: 'SELECT * FROM cart WHERE user_id = $1',
            values: [user_id]
        };
        const result = await pool.query(query);

        for(let i = 0; i < result.rows.length; i++) {
            const productQuery = {
                text: 'SELECT * FROM products WHERE id = $1',
                values: [result.rows[i].product_id]
            };
            const product = await pool.query(productQuery.text, productQuery.values);

            const categoryQuery = {
                text: 'SELECT * FROM categories WHERE id = $1',
                values: [product.rows[0].category_id]
            }
            const category = await pool.query(categoryQuery.text, categoryQuery.values);
            product.rows[0].category = category.rows[0];
            result.rows[i].product = product.rows[0];
        }
        return result.rows;
    },
    removeFromCart: async (mobile, product_id) => {
        const userQuery = {
            text: 'SELECT id FROM users WHERE phone_number = $1',
            values: [mobile]
        };
        const user = await pool.query(userQuery.text, userQuery.values);
        if(user.rows.length === 0) {
            return [];
        }
        const user_id = user.rows[0].id;
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
    updateCart: async (mobile, product_id, quantity) => {
        const userQuery = {
            text: 'SELECT id FROM users WHERE phone_number = $1',
            values: [mobile]
        };
        const user = await pool.query(userQuery.text, userQuery.values);
        if(user.rows.length === 0) {
            return [];
        }
        const user_id = user.rows[0].id;
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
        const { mobile, store_id, delivery_address_id, payment_method, total, order_status, payment_status, transaction_id, created_at, expected_delivery } = order;
        const userQuery = {
            text: 'SELECT id FROM users WHERE phone_number = $1',
            values: [mobile]
        };
        const user = await pool.query(userQuery.text, userQuery.values);
        if(user.rows.length === 0) {
            return [];
        }
        const user_id = user.rows[0].id;
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
    getOrders: async (mobile) => {
        const userQuery = {
            text: 'SELECT id FROM users WHERE phone_number = $1',
            values: [mobile]
        };
        const user = await pool.query(userQuery.text, userQuery.values);
        if(user.rows.length === 0) {
            return [];
        }
        const user_id = user.rows[0].id;
        const query = {
            text: 'SELECT * FROM orders WHERE user_id = $1',
            values: [user_id]
        };
        const result = await pool.query(query);
        return result.rows;
    },
    updateOrder: async (order) => {
        const { order_id, mobile, store_id, delivery_address_id, payment_method, total, order_status, payment_status, transaction_id, created_at, expected_delivery } = order;
        const userQuery = {
            text: 'SELECT id FROM users WHERE phone_number = $1',
            values: [mobile]
        };
        const user = await pool.query(userQuery.text, userQuery.values);
        if(user.rows.length === 0) {
            return [];
        }
        const user_id = user.rows[0].id;
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
        const { mobile, type, address_line_1, address_line_2, city, state, pincode, phone_number } = delivery_address;
        const userQuery = {
            text: 'SELECT id FROM users WHERE phone_number = $1',
            values: [mobile]
        };
        const user = await pool.query(userQuery.text, userQuery.values);
        if(user.rows.length === 0) {
            return [];
        }
        const user_id = user.rows[0].id;
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
    getDeliveryAddresses: async (mobile) => {
        const userQuery = {
            text: 'SELECT id FROM users WHERE phone_number = $1',
            values: [mobile]
        };
        const user = await pool.query(userQuery.text, userQuery.values);
        if(user.rows.length === 0) {
            return [];
        }
        const user_id = user.rows[0].id;
        const query = {
            text: 'SELECT * FROM delivery_addresses WHERE user_id = $1',
            values: [user_id]
        };
        const result = await pool.query(query);
        return result.rows;
    },
    updateDeliveryAddress: async (delivery_address) => {
        const { id, mobile, type, address_line_1, address_line_2, city, state, pincode, phone_number } = delivery_address;
        const userQuery = {
            text: 'SELECT id FROM users WHERE phone_number = $1',
            values: [mobile]
        };
        const user = await pool.query(userQuery.text, userQuery.values);
        if(user.rows.length === 0) {
            return [];
        }
        const user_id = user.rows[0].id;
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

const homeData = {
    getHome: async () => {
        const categories = await categoriesData.getCategories();
        const products = await productsData.getVerifiedProducts('all');
        const stores = await storesData.getVerifiedStores();
        return { categories, products, stores };
    }
}

module.exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',  // Allow all origins, or specify a domain
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    try {
        const body = event ? event : null;
        
        if(!body || body === null){
            return {
                statusCode: 500,
                body: { error: 'Empty body. Please check payload' }
            };
        }

        const { path } = body;

        if(path === '/add/cart') {
            try {
                const { mobile, product_id, quantity } = body;
                const result = await cartData.addToCart(mobile, product_id, quantity);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/search/products') {
            try {
                const { search } = body;
                const result = await productsData.searchProducts(search);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if( path === '/get/cart') {
            try {
                const { mobile } = body;
                const result = await cartData.getCart(mobile);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/update/cart') {
            try {
                const { mobile, product_id, quantity } = body;
                const result = await cartData.updateCart(mobile, product_id, quantity);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if( path === '/remove/cart') {
            try {
                const { mobile, product_id } = body;
                const result = await cartData.removeFromCart(mobile, product_id);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/create/category') {
            try {
                const category = body;
                const result = await categoriesData.createCategory(category);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/get/categories') {
            try {
                const result = await categoriesData.getCategories();
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/get/categories-details') {
            try {
                const result = await categoriesData.getCategoriesDetails();
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/update/category') {
            try {
                const category = body;
                const result = await categoriesData.updateCategory(category);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/delete/category') {
            try {
                const { id } = body;
                const result = await categoriesData.deleteCategory(id);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/add/deliveryAddress') {
            try {
                const deliveryAddress = body;
                const result = await deliveryAddressData.createDeliveryAddress(deliveryAddress);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/get/deliveryAddress') {
            try {
                const { user_id } = body;
                const result = await deliveryAddressData.getDeliveryAddresses(user_id);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if( path === '/update/deliveryAddress') {
            try {
                const deliveryAddress = body;
                const result = await deliveryAddressData.updateDeliveryAddress(deliveryAddress);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if( path === '/remove/deliveryAddress') {
            try {
                const { id } = body;
                const result = await deliveryAddressData.deleteDeliveryAddress(id);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/add/orderItem') {
            try {
                const orderItems = body;
                const result = await orderItemsData.createOrderItem(orderItems);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/get/orderItem') {
            try {
                const { order_id } = body;
                const result = await orderItemsData.getOrderItems(order_id);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if( path === '/update/orderItem') {
            try {
                const orderItems = body;
                const result = await orderItemsData.updateOrderItem(orderItems);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/remove/orderItem') {
            try {
                const { order_id } = body;
                const result = await orderItemsData.deleteOrderItem(order_id);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/add/order') {
            try {
                const orders = body;
                const result = await orderData.createOrder(orders);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/get/order') {
            try {
                const { user_id } = body;
                const result = await orderData.updateOrder(user_id);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/update/order') {
            try {
                const orders = body;
                const result = await orderData.updateOrder(orders);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if( path === '/remove/order') {
            try {
                const { order_id } = body;
                const result = await orderData.deleteOrder(order_id);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if( path === '/create/product') {
            try {
                const product = body;
                const result = await productsData.createProduct(product);
                if(result) {
                    return {
                    statusCode: 200,
                    headers,
                    body: {success: true}
                }
                } else {
                    return {
                    statusCode: 200,
                    headers,
                    body: {success: false}
                }
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/accept/product') {
            try {
                const { id } = body;
                const result = await productsData.acceptProduct(id);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/reject/product') {
            try {
                const { id, comments } = body;
                const result = await productsData.rejectProduct(id, comments);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/get/products') {
            try {
                const { category } = body;
                const result = await productsData.getAllProducts(category);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                console.log("Error: ", error);
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/update/product') {
            try {
                const product = body;
                const result = await productsData.updateProduct(product);
                if(result) {
                    return {
                    statusCode: 200,
                    headers,
                    body: {success: true}
                }
                } else {
                    return {
                        statusCode: 200,
                        headers,
                        body: {success: false}
                    }
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/get/product') {
            try {
                const { id } = body;
                const result = await productsData.getProduct(id);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/delete/product') {
            try {
                const { id } = body;
                const result = await productsData.deleteProduct(id);
                if(result) {
                    return {
                        statusCode: 200,
                        headers,
                        body: {success: true}
                    }
                } else {
                    return {
                        statusCode: 200,
                        headers,
                        body: {success: false}
                    }
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/get/products/for/seller') {
            try {
                const { mobile } = body;
                const result = await productsData.getProductsForSeller(mobile);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/get/unverified/products') {
            const { category } = body;
            const result = await productsData.getUnverifiedProducts(category);
            return {
                statusCode: 200,
                headers,
                body: result
            }
        } else if(path === '/get/verified/products') {
            const { category } = body;
            const result = await productsData.getVerifiedProducts(category);
            return {
                statusCode: 200,
                headers,
                body: result
            }
        } else if(path === '/get/verified/sellers') {
            try {
                const result = await userData.getVerifiedSellers();
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/get/unverified/sellers') {
            try {
                const result = await userData.getUnverifiedSellers();
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/create/store') {
            try {
                const store = body;
                const result = await storesData.createStore(store);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/get/stores') {
            try {
                const result = await storesData.getStores();
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/update/store') {
            try {
                const store = body;
                const result = await storesData.updateStore(store);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/delete/store') {
            try {
                const { id } = body;
                const result = await storesData.deleteStore(id);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/accept/seller') {
            try {
                const { mobile } = body;
                const result = await storesData.acceptSeller(mobile);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/reject/seller') {
            try {
                const { mobile, comments } = body;
                const result = await storesData.rejectSeller(mobile, comments);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/user/onboarding') {
            try {
                const user = body;
                const result = await userData.registerUser(user);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                console.log("Error: ", error);
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/login/user') {
            try {                
                const { emailOrMob, password } = body;
                const user = await userData.getUserByEmailOrMob(emailOrMob);
                
                if (user.password === password) {
                    return {
                    statusCode: 200,
                    headers,
                    body: user
                }
                } else {
                    return {
                    statusCode: 401,
                    headers,
                    body: 'Invalid password'
                }
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/send/otp') {
            try {
                const { mobile } = body;
                // await userData.sendOTP(mobile);
                return {
                    statusCode: 200,
                    headers,
                    body: 'OTP sent successfully'
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/verify/otp') {
            try {
                const { mobile, otp } = body;
                const result = await userData.verifyOTP(mobile, otp);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                console.log("Error: ", error);
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/deregister/user') {
            try {
                const { email } = body;
                const result = await userData.deRegisterUser(email);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/get/user') {
            try {
                const { mobile } = body;
                const result = await userData.getUserByEmailOrMob(mobile);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                console.log("Error: ", error);
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/register/seller') {
            try {
                const seller = body;
                const result = await userData.registerSeller(seller);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                console.log("Error: ", error);
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/get/user-type') {
            try {
                const { mobile } = body;
                const result = await userData.getUserType(mobile);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                console.log("Error: ", error);
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/get/submitted-sellers') {
            try {
                const result = await userData.getSubmittedSellers();
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                console.log("Error: ", error);
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/get/seller-submitted-details') {
            try {
                const { mobile } = body;
                const result = await userData.getSellerSubmittedDetails(mobile);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                console.log("Error: ", error);
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/create/wishlist') {
            try {
                const { mobile, product_id } = body;
                const result = await wishlistData.addToWishlist(mobile, product_id);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/get/wishlist') {
            try {
                const { mobile } = body;
                const result = await wishlistData.getWishlist(mobile);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/delete/wishlist') {
            try {
                const { mobile, product_id } = body;
                const result = await wishlistData.removeFromWishlist(mobile, product_id);
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else if(path === '/get/home') {
            try {
                const result = await homeData.getHome();
                return {
                    statusCode: 200,
                    headers,
                    body: result
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error
                }
            }
        } else {
            return {
                statusCode: 500,
                body: { error: 'Invalid path. Please check payload' }
            };
        }
    } catch (error) {
        console.error('Database query failed', error);
        return {
            statusCode: 500,
            body: { error: 'Database query failed' }
        };
    }
}