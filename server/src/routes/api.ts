import express from 'express';
import { googleAuthService } from '../services/googleAuth';

const router = express.Router();

router.get('/users/:id', (req, res) => {
    try {
        const user = googleAuthService.getUser(req.params.id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/calendar/:userId/events', async (req, res) => {
    try {
        const events = await googleAuthService.getCalendarEvents(req.params.userId);
        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

export default router;
