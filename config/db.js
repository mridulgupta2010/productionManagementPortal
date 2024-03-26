require('dotenv').config();
const mongoose = require("mongoose");

mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true}).then(()=> {
    console.log("Database connection is successfull!")
}).catch((err)=> console.log(err))