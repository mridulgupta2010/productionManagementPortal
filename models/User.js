const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    userName: String,
    userFirstName: String,
    userLastName: String,
    email: String,
    password: String,
    userID: String
})

const User = mongoose.model('productionUser', UserSchema);

module.exports = User;
// const UserSchema = new Schema({
//     custAccount: String,
//     custName: String,
//     logisticAddressStreet: String,
//     logisticAddressCity: String,
//     logisticAddressPostcode: String,
//     orderID: String,
//     salesOrigin: String,
//     itemsID: String,
//     itemDescription: String,
//     dispatchDate: Date,
//     itemQuantity: Number,
//     comment: [
//         userID
//     ]
// })