const express = require('express');
const router = express.Router();
const users = require('../model/Users');
require('dotenv').config();
// Inscription d'un nouvel administrateur

router.post('/', async (req, res) => {
    console.log('Received request to create a new user:', req.body); // Log the request body

    try {
        const password = req.body.password;
        if (password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).send({ message: 'Mot de passe incorrect' });
        }
        const { name, token } = req.body;
        users.findOne({ token }, async (err, existingUser) => {
            if (err) {
                console.error('Error checking for existing user:', err);
                return res.status(500).send({ message: 'Erreur interne du serveur' });
            }
            if (existingUser) {
                return res.status(200).send({ message: 'Un utilisateur avec ce token existe déjà' });
            }
        }
        );
        const user = new users({ name, token });
        await user.save();
        res.status(201).send(user);
    } catch (err) {
        res.status(400).send(err);
    }
});

// Récupérer tous les utilisateurs
router.get('/', async (req, res) => {
    try {
        const allUsers = await users.find();
        res.status(200).send(allUsers);
    } catch (err) {
        res.status(500).send(err);
    }
});

// Récupérer un utilisateur par ID
router.get('/:id', async (req, res) => {
    try {
        const user = await users.find({ _id: req.params.id});
        if (!user) {
            return res.status(404).send({ message: 'Utilisateur non trouvé' });
        }
        res.status(200).send(user);
    } catch (err) {
        console.error(err);
        res.status(500).send(err);
    }
});

// Mettre à jour un utilisateur par ID
router.put('/:id', async (req, res) => {
    try {
        const updatedUser = await users.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updatedUser) {
            return res.status(404).send({ message: 'Utilisateur non trouvé' });
        }
        res.status(200).send(updatedUser);
    } catch (err) {
        res.status(400).send(err);
    }
});

// Supprimer un utilisateur par ID
router.delete('/:id', async (req, res) => {
    try {
        const deletedUser = await users.findByIdAndDelete(req.params.id);
        if (!deletedUser) {
            return res.status(404).send({ message: 'Utilisateur non trouvé' });
        }
        res.status(200).send({ message: 'Utilisateur supprimé avec succès' });
    } catch (err) {
        res.status(500).send(err);
    }
});

module.exports = router;
