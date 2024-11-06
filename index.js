// lambda serverless
const express = require('express');
const serverless = require('serverless-http');

const app = express();
app.use(express.json());

const isLocalEnv = process.env.NODE_ENV === 'development';

const userRoutes = require('./routes/userRoutes');
userRoutes.register_routes(app);

if(isLocalEnv) {
    const PORT = 4000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
} else {
    exports.handler = serverless(app);
}