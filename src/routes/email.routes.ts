import { Router } from 'express';
import { EmailController } from '../controllers/EmailController';

const router = Router();

router.post('/send-notification', EmailController.sendNotification);

export default router; 