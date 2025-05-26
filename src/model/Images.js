const mongoose = require('mongoose');

const images = mongoose.model('images', {
    imageUrl: {
        type: String,
        required: [true, "name is required"],
    },
    time:{
        type:Date,
        default:Date.now
    }
});

module.exports = images;
