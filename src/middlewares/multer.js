const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Crée le dossier uploads s'il n'existe pas
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configuration du stockage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Math.floor(Date.now() / 1000); // Timestamp en secondes
        const ext = path.extname(file.originalname); // Extension du fichier
        cb(null, `${timestamp}${ext}`); // Ex: 1712216840.jpg
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Seules les images sont autorisées'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo
});

module.exports = upload;
