const express = require('express');
const router = express.Router();
const users = require('../model/Users');
require('dotenv').config();

// Inscription d'un nouvel administrateur
router.post('/', async (req, res) => {
    try {
        const { name, token, password } = req.body;

        if (password !== process.env.ADMIN_PASSWORD) {
            console.error('Mot de passe incorrect pour l\'inscription d\'un administrateur');
            return res.status(401).send({ message: 'Mot de passe incorrect' });
        }

        const existingUser = await users.findOne({ token });

        if (existingUser) {
            return res.status(200).send({ message: 'Un utilisateur avec ce token existe déjà' });
        }

        const newUser = new users({ name, token });
        await newUser.save();

        res.status(201).send(newUser);

    } catch (err) {
        console.error('Erreur lors de l\'inscription de l\'administrateur:', err);
        res.status(400).send({ message: 'Erreur lors de la création', error: err.message });
    }
});

// Récupérer tous les utilisateurs
router.get('/', async (req, res) => {
    try {
        const allUsers = await users.find();
        res.status(200).send(allUsers);
    } catch (err) {
        res.status(500).send({ message: 'Erreur serveur', error: err.message });
    }
});

// Récupérer un utilisateur par ID
router.get('/:id', async (req, res) => {
    try {
        const user = await users.findById(req.params.id);
        if (!user) {
            return res.status(404).send({ message: 'Utilisateur non trouvé' });
        }
        res.status(200).send(user);
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Erreur serveur', error: err.message });
    }
});

// Mettre à jour un utilisateur par ID
router.put('/:id', async (req, res) => {
    try {
        const updatedUser = await users.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!updatedUser) {
            return res.status(404).send({ message: 'Utilisateur non trouvé' });
        }
        res.status(200).send(updatedUser);
    } catch (err) {
        res.status(400).send({ message: 'Erreur de mise à jour', error: err.message });
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
        res.status(500).send({ message: 'Erreur serveur', error: err.message });
    }
});

module.exports = router;
