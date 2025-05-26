const mongoose = require('mongoose');

const users = mongoose.model('users', {
    name: {
        type: String,
        required: [true, "name is required"],
        unique: false,
    },
    token: {
        type: String,
        required: [true, "token is required"],
        unique: true
    }
});

module.exports = users;
