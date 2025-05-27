const express = require('express');
const router = express.Router();
const Images = require('../model/Images');
const ImagesPerson = require('../model/ImagesPerson');
const upload = require('../middlewares/multer');
const admin = require('firebase-admin');
const Users = require('../model/Users');
const axios = require('axios');

require('dotenv').config();

const serviceAccount = require('../../serviceAccountKey.json');

// Configuration Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

// Configuration des constantes
const CONFIDENCE_THRESHOLD = 0.7;
const DETECTED_USERS = ['alice', 'bob', 'charlie', 'dave', 'eve'];
const BACKEND_URL = process.env.BACKEND_URL || 'https://backend-safehome.onrender.com';
const GRADIO_URL = process.env.GRADIO_URL;

// Validation de l'environnement
if (!GRADIO_URL) {
    console.error('❌ GRADIO_URL n\'est pas défini dans les variables d\'environnement');
}

/**
 * Extrait l'objet data d'une réponse en streaming
 * @param {string} eventString - La chaîne de réponse de l'événement
 * @returns {Object|null} - L'objet parsé ou null en cas d'erreur
 */
const extractDataObject = (eventString) => {
    try {
        const match = eventString.match(/data: (.+)\n/);
        if (match && match[1]) {
            return JSON.parse(match[1]);
        }
        return null;
    } catch (error) {
        console.error("❌ Erreur de parsing JSON:", error);
        return null;
    }
};

/**
 * Appelle l'API Gradio pour la prédiction d'image
 * @param {string} imageUrl - URL de l'image à analyser
 * @returns {Promise<Object>} - Résultat de la prédiction
 */
const callGradioAPI = async (imageUrl) => {
    try {
        // 1. Initier la prédiction
        const postResponse = await axios.post(
            `${GRADIO_URL}/gradio_api/call/predict`,
            {
                data: [{
                    path: imageUrl,
                    meta: { _type: "gradio.FileData" }
                }]
            },
            {
                headers: { "Content-Type": "application/json" },
                timeout: 10000 // Timeout de 10 secondes
            }
        );

        const eventId = postResponse.data.event_id;
        if (!eventId) {
            throw new Error("Aucun event_id retourné par Gradio");
        }

        // 2. Récupérer le résultat
        const resultUrl = `${GRADIO_URL}/gradio_api/call/predict/${eventId}`;
        const resultResponse = await axios.get(resultUrl, { timeout: 15000 });
        
        return extractDataObject(resultResponse.data);
    } catch (error) {
        console.error("❌ Erreur lors de l'appel à l'API Gradio:", error.message);
        throw new Error(`Erreur API Gradio: ${error.message}`);
    }
};

/**
 * Analyse les prédictions et détermine le type de détection
 * @param {Object} predictions - Objet des prédictions
 * @returns {Object} - Résultat de l'analyse { isPersonDetected, detectedUser, userIndex }
 */
const analyzePredictions = (predictions) => {
    if (!predictions || typeof predictions !== 'object') {
        return { isPersonDetected: true, detectedUser: null, userIndex: -1 };
    }

    let highestConfidence = 0;
    let detectedUserIndex = -1;

    // Trouver la prédiction avec la plus haute confiance
    Object.entries(predictions).forEach(([key, confidence], index) => {
        const confidenceValue = parseFloat(key);
        if (confidenceValue > highestConfidence && confidenceValue > CONFIDENCE_THRESHOLD) {
            highestConfidence = confidenceValue;
            detectedUserIndex = index;
        }
    });

    const isPersonDetected = detectedUserIndex === -1;
    const detectedUser = detectedUserIndex >= 0 && detectedUserIndex < DETECTED_USERS.length 
        ? DETECTED_USERS[detectedUserIndex] 
        : null;

    return { isPersonDetected, detectedUser, userIndex: detectedUserIndex };
};

/**
 * Envoie une notification Firebase
 * @param {string} title - Titre de la notification
 * @param {string} body - Corps de la notification
 * @returns {Promise<Object>} - Réponse de Firebase
 */
const sendNotification = async (title, body) => {
    try {
        const message = {
            notification: { title, body },
            topic: 'all',
        };
        
        const response = await admin.messaging().send(message);
        console.log('✅ Notification envoyée avec succès:', response);
        return response;
    } catch (error) {
        console.error('❌ Erreur lors de l\'envoi de la notification:', error);
        throw new Error(`Erreur notification: ${error.message}`);
    }
};

/**
 * Traite l'upload et l'analyse d'image
 */
router.post('/', upload.single('image'), async (req, res) => {
    try {
        // Validation de l'entrée
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                error: 'Aucune image fournie' 
            });
        }

        if (!GRADIO_URL) {
            return res.status(500).json({ 
                success: false,
                error: 'Configuration Gradio manquante' 
            });
        }

        const imageUrl = `${BACKEND_URL}/uploads/${req.file.filename}`;
        console.log(`📸 Traitement de l'image: ${imageUrl}`);

        // Sauvegarde dans la base de données
        const image = new Images({ imageUrl });
        await image.save();
        console.log('✅ Image sauvegardée en base de données');

        // Appel à l'API Gradio
        const gradioResult = await callGradioAPI(imageUrl);
        
        if (!gradioResult || !gradioResult[0] || !gradioResult[0].prediction) {
            return res.status(500).json({ 
                success: false,
                error: 'Réponse invalide de l\'API de prédiction' 
            });
        }

        // Analyse des prédictions
        const predictions = gradioResult[0].prediction[0];
        const { isPersonDetected, detectedUser } = analyzePredictions(predictions);

        // Préparation de la notification
        let notificationTitle, notificationBody;
        
        if (isPersonDetected) {
            notificationTitle = 'Alerte de sécurité';
            notificationBody = 'Une personne inconnue a été détectée dans votre maison';
            ImagesPerson.create({ imageUrl }); // Sauvegarde de l'image dans la collection ImagesPerson
        } else {
            notificationTitle = 'Personne autorisée détectée';
            notificationBody = `${detectedUser} a été détecté(e) dans votre maison`;
            ImagesPerson.create({ imageUrl, user: detectedUser }); // Sauvegarde de l'image avec l'utilisateur détecté
        }

        // Envoi de la notification
        const notificationResponse = await sendNotification(notificationTitle, notificationBody);

        // Réponse de succès
        return res.status(201).json({
            success: true,
            message: 'Image traitée avec succès',
            data: {
                imageId: image._id,
                imageUrl,
                analysis: {
                    isPersonDetected,
                    detectedUser,
                    confidence: predictions
                },
                notification: {
                    sent: true,
                    response: notificationResponse
                }
            }
        });

    } catch (error) {
        console.error('❌ Erreur lors du traitement de l\'image:', error);
        return res.status(500).json({ 
            success: false,
            error: 'Erreur interne du serveur',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * Récupère la dernière image
 */
router.get('/last', async (req, res) => {
    try {
        const lastImage = await ImagesPerson.findOne().sort({ _id: -1 });
        
        if (!lastImage) {
            return res.status(404).json({ 
                success: false,
                error: 'Aucune image trouvée' 
            });
        }
        
        return res.status(200).json({
            lastImage
        });
    } catch (error) {
        console.error('❌ Erreur lors de la récupération de la dernière image:', error);
        return res.status(500).json({ 
            success: false,
            error: 'Erreur interne du serveur' 
        });
    }
});

/**
 * Récupère toutes les images
 */
router.get('/', async (req, res) => {
    try {
        const allImages = await ImagesPerson.find();
        return res.status(200).json(allImages);
    } catch (err) {
        console.error('❌ Erreur :', err);
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;