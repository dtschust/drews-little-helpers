require('dotenv').config();
const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

mongoose.connect(process.env.MONGO_DB_URI, {});

function getMongoose() {
	return mongoose;
}

module.exports = { getMongoose };
