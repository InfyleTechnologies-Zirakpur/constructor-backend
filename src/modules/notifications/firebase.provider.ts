import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert, type App } from 'firebase-admin';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';

/**
 * Firebase provider — initializes Firebase Admin SDK for FCM.
 * Reads credentials from environment variables.
 *
 * The user will provide the Firebase service account JSON later;
 * until then, the provider gracefully skips initialization.
 */
@Injectable()
export class FirebaseProvider implements OnModuleInit {
  private readonly logger = new Logger(FirebaseProvider.name);
  private app: App | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    try {
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      const clientEmail = this.configService.get<string>(
        'FIREBASE_CLIENT_EMAIL',
      );
      const privateKey = this.configService
        .get<string>('FIREBASE_PRIVATE_KEY')
        ?.replace(/\\n/g, '\n');

      if (!projectId || !clientEmail || !privateKey) {
        this.logger.warn(
          'Firebase credentials not configured — push notifications disabled. ' +
            'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env',
        );
        return;
      }

      // Avoid re-initializing if already done
      const existingApps = getApps();
      if (existingApps.length > 0) {
        this.app = existingApps[0]!;
        this.logger.log('Firebase Admin SDK already initialized');
        return;
      }

      this.app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });

      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
    }
  }

  /**
   * Send a push notification to a single device token.
   */
  async sendToDevice(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.app) {
      this.logger.warn('Firebase not initialized — skipping push');
      return false;
    }

    try {
      await getMessaging(this.app).send({
        token,
        notification: { title, body },
        data: data ?? {},
        android: {
          priority: 'high',
          notification: { sound: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      });
      return true;
    } catch (error: any) {
      // Handle invalid/expired tokens
      if (
        error?.code === 'messaging/registration-token-not-registered' ||
        error?.code === 'messaging/invalid-registration-token'
      ) {
        this.logger.warn(`Invalid FCM token: ${token.slice(0, 20)}...`);
        return false;
      }
      this.logger.error(`FCM send failed: ${error?.message}`);
      return false;
    }
  }

  /**
   * Send a push notification to multiple device tokens (batch).
   * Returns the list of tokens that failed (invalid/expired).
   */
  async sendToDevices(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string[]> {
    if (!this.app || tokens.length === 0) return [];

    try {
      const message: MulticastMessage = {
        tokens,
        notification: { title, body },
        data: data ?? {},
        android: {
          priority: 'high',
          notification: { sound: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      };

      const response = await getMessaging(this.app).sendEachForMulticast(
        message,
      );

      // Collect failed tokens for cleanup
      const failedTokens: string[] = [];
      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });

      this.logger.log(
        `FCM batch: ${response.successCount} sent, ${response.failureCount} failed`,
      );

      return failedTokens;
    } catch (error: any) {
      this.logger.error(`FCM batch send failed: ${error?.message}`);
      return tokens; // treat all as failed
    }
  }

  isInitialized(): boolean {
    return this.app !== null;
  }
}
