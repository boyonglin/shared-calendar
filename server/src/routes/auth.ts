import express from 'express';
import { googleAuthService } from '../services/googleAuth';

const router = express.Router();

router.get('/google', (req, res) => {
    const url = googleAuthService.getAuthUrl();
    res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
        res.status(400).send('Missing code');
        return;
    }

    try {
        const result = await googleAuthService.handleCallback(code);

        // Redirect back to client with success
        // In a real app, we'd probably set a session cookie here
        // For now, we'll redirect to the client app with a query param indicating success
        // The client can then fetch the user status
        res.redirect(`${process.env.CLIENT_URL}?auth=success&userId=${result.user.id}`);
    } catch (error: any) {
        console.error('Auth error:', error);
        res.status(500).send(`Authentication failed: ${error.message}\n\nCheck server console for details.`);
    }
});

export default router;
