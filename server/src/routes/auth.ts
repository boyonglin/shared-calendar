import express, { Request, Response } from 'express';
import { googleAuthService } from '../services/googleAuth';
import { icloudAuthService } from '../services/icloudAuth';
import { validateICloudCredentials } from '../middleware/validation';
import { env } from '../config/env';

const router = express.Router();

router.get('/google', (req: Request, res: Response) => {
  const url = googleAuthService.getAuthUrl();
  res.redirect(url);
});

router.get('/google/callback', async (req: Request, res: Response) => {
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
    res.redirect(`${env.CLIENT_URL}?auth=success&userId=${result.user.id}`);
  } catch (error: any) {
    console.error('Auth error:', error);
    res
      .status(500)
      .send(`Authentication failed: ${error.message}\n\nCheck server console for details.`);
  }
});

router.post('/icloud', validateICloudCredentials, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const result = await icloudAuthService.verifyCredentials(email, password);
    res.json(result);
  } catch (error: any) {
    console.error('iCloud auth error:', error);
    res.status(401).json({ error: error.message || 'Authentication failed' });
  }
});

export default router;
