const mongoose = require('mongoose');

const ImagesPerson = mongoose.model('ImagesPerson', {
    imageUrl: {
        type: String,
        required: [true, "name is required"],
    },
    time:{
        type:Date,
        default:Date.now
    }
});

module.exports = ImagesPerson;
