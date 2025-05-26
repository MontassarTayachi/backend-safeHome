const express = require('express');
const path = require('path');
const userRoute = require('./routes/UsersController');
const cors = require('cors');
const imagesRoute = require('./routes/ImagesController');
require('./mogoDB/Connect');
const app = express();
app.use(express.json());
app.use(cors('*'));  
app.use(express.urlencoded({ extended: true }));
app.use(express.static('./'))
app.use('/users', userRoute);
app.use('/images', imagesRoute);
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Pour servir les fichiers d'images
module.exports = app;
