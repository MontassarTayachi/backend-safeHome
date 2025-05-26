const express = require('express');
const router = express.Router();
const Images = require('../model/Images');
const upload = require('../middlewares/multer');
const admin = require('firebase-admin');
const Users = require('../model/Users');
const axios = require('axios');


require('dotenv').config();

const serviceAccount = require('../../serviceAccountKey.json');
const { copyFileSync } = require('fs');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

router.post('/', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucune image fournie' });
        }

        const BACKEND_URL = process.env.BACKEND_URL || 'https://backend-safehome.onrender.com';
        const imageUrl = `${BACKEND_URL}/uploads/${req.file.filename}`;

        // Sauvegarde dans la base de données
        const image = new Images({ imageUrl });
        await image.save();
       const postResponse = await axios.post(
      process.env.GRADIO_URL+"/gradio_api/call/predict",
      {
        data: [
          {
            path: imageUrl,
            meta: { _type: "gradio.FileData" }
          }
        ]
      },
      {
        headers: { "Content-Type": "application/json" }
      }
    );

    const eventId = postResponse.data.event_id;

    if (!eventId) {
      return res.status(500).json({ error: "No event_id returned from Gradio." });
    }

    // 2. Interroger le résultat en streaming
    const resultUrl =  process.env.GRADIO_URL+`/gradio_api/call/predict/${eventId}`;
    const resultResponse = await axios.get(resultUrl);
    const rest = extractDataObject(resultResponse.data);
   if (rest[0]) {
     const prediction = rest[0].prediction[0];
     let istrouve = false; 
     let indice = 0;
     for (const key in prediction) {
        indice++;
        if (key > 0.5){
        istrouve = true;
        break;
        }
     }
        if (!istrouve) {
            const message = {
            notification: {
              title: 'Alerte de sécurité',
              body: 'un personne a été détectée dans votre maison',
            },
            topic: 'all',
          };
           const response = await admin.messaging().send(message);
           
        return res.status(201).json({
            message: 'Image ajoutée avec succès',
            response,
            notificationResponse: 'Toutes les notifications ont été envoyées avec succès',
        });
           
        }
        else {
            const NomUserDetecter= ['alice', 'bob', 'charlie', 'dave', 'eve'];
             const message = {
            notification: {
              title: 'Alerte de sécurité',
              body: NomUserDetecter[indice-1] + ' a été détecté dans votre maison',
            },
            topic: 'all',
          };
           const response = await admin.messaging().send(message);
            return res.status(201).json({
                message: 'Image ajoutée avec succès',
                response,
                notificationResponse: 'Toutes les notifications ont été envoyées avec succès',
            });
        }
        
    
    }

   
        
 
        

    } catch (err) {
        console.error('❌ Erreur :', err);
        return res.status(500).json({ error: err.message });
    }
});

router.get('/last', async (req, res) => {
    try {
        const lastImage = await Images.findOne().sort({ _id: -1 });
        if (!lastImage) {
            return res.status(404).json({ error: 'Aucune image trouvée' });
        }
        return res.status(200).json(lastImage);
    } catch (err) {
        console.error('❌ Erreur :', err);
        return res.status(500).json({ error: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const allImages = await Images.find();
        return res.status(200).json(allImages);
    } catch (err) {
        console.error('❌ Erreur :', err);
        return res.status(500).json({ error: err.message });
    }
});
const extractDataObject =  (eventString) =>  {
  const match = eventString.match(/data: (.+)\n/);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      console.error("Erreur de parsing JSON:", e);
      return null;
    }
  }
  return null;
}

module.exports = router;